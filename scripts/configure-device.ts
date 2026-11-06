import { constants, generateKeyPairSync, privateDecrypt, createDecipheriv, randomUUID, type KeyObject } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, readFile, rename, link, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const credentialNames = ['REALSEE_APP_KEY', 'REALSEE_APP_SECRET', 'REALSEE_TEAM_SOURCE'] as const;
const gateways = new Set(['https://app-gateway.realsee.ai', 'https://app-gateway.autoenv.realsee.com']);

export class DeviceSetupError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export interface DeviceConfig {
  appKey: string;
  appSecret: string;
  teamSource: string;
  gatewayBaseUrl: string;
}

export function portalOrigin(raw = 'https://developer.realsee.ai') {
  let url: URL;
  try { url = new URL(raw); } catch { throw new DeviceSetupError('INVALID_PORTAL', 'Use the official Realsee developer portal.'); }
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  const localPreview = url.origin === 'https://local.developer.realsee.ai:8443';
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (!local && !localPreview && (url.protocol !== 'https:' || !['developer.realsee.ai', 'developer.preline.realsee.ai'].includes(url.hostname) || url.port)) ||
      (local && !['http:', 'https:'].includes(url.protocol))) {
    throw new DeviceSetupError('INVALID_PORTAL', 'Use the official Realsee developer portal.');
  }
  return url.origin;
}

function base64Bytes(value: unknown, maxBytes = 16_384) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/u.test(value) || value.length > maxBytes * 2) throw new Error();
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || bytes.length > maxBytes) throw new Error();
  return bytes;
}

export function decryptDeviceConfig(payload: unknown, privateKey: KeyObject): DeviceConfig {
  try {
    if (!payload || typeof payload !== 'object') throw new Error();
    const envelope = payload as Record<string, unknown>;
    if (envelope.version !== 1 || envelope.algorithm !== 'RSA-OAEP-256+A256GCM') throw new Error();
    const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, base64Bytes(envelope.encryptedKey, 512));
    const iv = base64Bytes(envelope.iv, 12);
    const tag = base64Bytes(envelope.authTag, 16);
    if (key.length !== 32 || iv.length !== 12 || tag.length !== 16) throw new Error();
    let decoded: unknown;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const cleartext = Buffer.concat([decipher.update(base64Bytes(envelope.ciphertext)), decipher.final()]);
      try { decoded = JSON.parse(cleartext.toString('utf8')); } finally { cleartext.fill(0); }
    } finally { key.fill(0); }
    if (!decoded || typeof decoded !== 'object') throw new Error();
    const config = decoded as Record<string, unknown>;
    for (const [name, max] of [['appKey', 160], ['appSecret', 512], ['teamSource', 160]] as const) {
      const value = config[name];
      if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error();
    }
    const gatewayBaseUrl = config.gatewayBaseUrl;
    if (typeof gatewayBaseUrl !== 'string' || !gateways.has(gatewayBaseUrl)) throw new Error();
    return { appKey: config.appKey as string, appSecret: config.appSecret as string, teamSource: config.teamSource as string, gatewayBaseUrl };
  } catch {
    throw new DeviceSetupError('INVALID_CONFIGURATION', 'The configuration could not be verified. Start a new authorization.');
  }
}

export async function readEnvironment(directory: string): Promise<string | null> {
  const filename = resolve(directory, '.env');
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new DeviceSetupError('UNSAFE_ENV_FILE', 'Use a regular .env file inside this project.');
    const handle = await open(filename, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    try {
      const current = await handle.stat();
      if (stat.ino !== current.ino || stat.dev !== current.dev || current.size > 128_000) throw new DeviceSetupError('UNSAFE_ENV_FILE', 'The .env file changed. Try again.');
      return await handle.readFile('utf8');
    } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof DeviceSetupError) throw error;
    throw new DeviceSetupError('ENV_UNREADABLE', 'The local .env file could not be read.');
  }
}

function environmentValues(text: string | null) {
  try { return parseEnv(text || ''); } catch { throw new DeviceSetupError('INVALID_ENV_FILE', 'Check the existing .env file before configuring this project.'); }
}

export function hasExistingCredentials(text: string | null) {
  const env = environmentValues(text);
  const present = credentialNames.filter((key) => Boolean(env[key]?.trim()));
  if (present.length && present.length !== credentialNames.length) throw new DeviceSetupError('PARTIAL_CONFIGURATION', 'The .env file already contains some credentials. Complete or clear those fields before authorizing another app.');
  return present.length === credentialNames.length;
}

function envLine(key: string, value: string) {
  for (const quote of ['"', "'", '`']) {
    if (value.includes(quote)) continue;
    const line = `${key}=${quote}${value}${quote}`;
    if (parseEnv(line)[key] === value) return line;
  }
  throw new DeviceSetupError('UNSUPPORTED_ENV_VALUE', 'A credential could not be written as an .env value. Configure this app locally.');
}

export async function writeEnvironment(directory: string, config: DeviceConfig, expected: string | null) {
  const latest = await readEnvironment(directory);
  if (latest !== expected) throw new DeviceSetupError('ENV_CHANGED', 'The .env file changed during authorization. It has been kept unchanged.');
  if (hasExistingCredentials(latest)) throw new DeviceSetupError('EXISTING_CONFIGURATION', 'Existing credentials have been kept unchanged.');
  const existing = environmentValues(latest);
  if (existing.REALSEE_GATEWAY_BASE_URL?.trim() && existing.REALSEE_GATEWAY_BASE_URL.trim() !== config.gatewayBaseUrl) {
    throw new DeviceSetupError('GATEWAY_CONFLICT', 'The existing gateway differs from this app’s gateway. Keep its credentials separate.');
  }
  let template = latest;
  if (template === null) {
    try { template = await readFile(resolve(directory, '.env.example'), 'utf8'); } catch { template = '# Realsee local configuration\n'; }
  }
  const values: Record<string, string> = {
    REALSEE_APP_KEY: config.appKey, REALSEE_APP_SECRET: config.appSecret,
    REALSEE_TEAM_SOURCE: config.teamSource, REALSEE_GATEWAY_BASE_URL: config.gatewayBaseUrl
  };
  if (!existing.REALSEE_MODE) values.REALSEE_MODE = 'team';
  const written = new Set<string>();
  const lines = template.split(/\r?\n/u).flatMap((line) => {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(line)?.[1];
    if (!key || !(key in values)) return [line];
    if (written.has(key)) return [];
    written.add(key);
    return [envLine(key, values[key]!)];
  });
  for (const [key, value] of Object.entries(values)) if (!written.has(key)) lines.push(envLine(key, value));
  const output = `${lines.join('\n').trimEnd()}\n`;
  const temporary = resolve(directory, `.env.realsee-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, output, { mode: 0o600, flag: 'wx' });
    if (await readEnvironment(directory) !== expected) throw new DeviceSetupError('ENV_CHANGED', 'The .env file changed during authorization. It has been kept unchanged.');
    if (expected === null) {
      await link(temporary, resolve(directory, '.env'));
    } else {
      await rename(temporary, resolve(directory, '.env'));
    }
  } catch (error) {
    if (error instanceof DeviceSetupError) throw error;
    throw new DeviceSetupError('ENV_WRITE_FAILED', 'The .env file could not be saved. Existing configuration has been kept.');
  } finally { await unlink(temporary).catch(() => undefined); }
  return resolve(directory, '.env');
}

interface SetupOptions {
  directory?: string;
  portal?: string;
  fetch?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  progress?: (message: string) => void;
}

export async function configureDevice(options: SetupOptions = {}) {
  const directory = resolve(options.directory || process.cwd());
  const origin = portalOrigin(options.portal);
  const original = await readEnvironment(directory);
  if (hasExistingCredentials(original)) {
    options.progress?.('Existing credentials found. Kept .env unchanged.');
    return { status: 'existing' as const, path: resolve(directory, '.env') };
  }
  const existingGateway = environmentValues(original).REALSEE_GATEWAY_BASE_URL?.trim();
  if (existingGateway && !gateways.has(existingGateway)) throw new DeviceSetupError('GATEWAY_CONFLICT', 'Keep the configured gateway and its credentials separate.');
  const request = options.fetch || fetch;
  const now = options.now || Date.now;
  const wait = options.wait || ((milliseconds: number) => delay(milliseconds));
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  async function post(path: string, body?: unknown, deviceCode?: string) {
    try {
      const response = await request(`${origin}${path}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { 'content-type': 'application/json', ...(deviceCode ? { authorization: `Bearer ${deviceCode}` } : {}) },
        body: JSON.stringify(body || {})
      });
      if (Number(response.headers.get('content-length')) > 65_536) throw new Error();
      const payload = await response.json() as { data?: unknown; error?: { code?: string } };
      return { response, payload };
    } catch {
      throw new DeviceSetupError('PORTAL_UNAVAILABLE', 'Could not reach the authorization service. Try again.');
    }
  }
  const started = await post('/api/agent-setup/device', { publicKey: publicKey.export({ type: 'spki', format: 'pem' }) });
  if (!started.response.ok) throw new DeviceSetupError('AUTHORIZATION_UNAVAILABLE', 'Agent authorization is unavailable. Try again or configure .env locally.');
  const device = started.payload.data as Record<string, unknown> | undefined;
  if (!device || typeof device.deviceCode !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/u.test(device.deviceCode) ||
      typeof device.userCode !== 'string' || !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/u.test(device.userCode) ||
      typeof device.expiresIn !== 'number' || device.expiresIn < 10 || device.expiresIn > 600 ||
      typeof device.interval !== 'number' || device.interval < 5 || device.interval > 60 ||
      typeof device.verificationUriComplete !== 'string') throw new DeviceSetupError('INVALID_DEVICE_RESPONSE', 'The authorization response could not be verified.');
  let verification: URL;
  try { verification = new URL(device.verificationUriComplete); } catch { throw new DeviceSetupError('INVALID_DEVICE_RESPONSE', 'The authorization response could not be verified.'); }
  if (verification.origin !== origin || verification.pathname !== '/agent/setup' || verification.username || verification.password ||
      verification.searchParams.get('user_code') !== device.userCode) throw new DeviceSetupError('INVALID_DEVICE_RESPONSE', 'The authorization link could not be verified.');
  options.progress?.(`Open ${verification.href}\nConfirm code ${device.userCode}, select your Team and app, then authorize.\nWaiting for your browser confirmation…`);
  const deadline = now() + device.expiresIn * 1000;
  let interval = device.interval;
  while (now() < deadline) {
    await wait(interval * 1000);
    if (now() >= deadline) break;
    const result = await post('/api/agent-setup/poll', {}, device.deviceCode);
    if (result.response.ok) {
      const config = decryptDeviceConfig(result.payload.data, privateKey);
      const filename = await writeEnvironment(directory, config, original);
      options.progress?.('Configured .env. Restart the local server and select Your Team to check the API.');
      return { status: 'configured' as const, path: filename };
    }
    const code = result.payload.error?.code;
    if (code === 'AUTHORIZATION_PENDING') continue;
    if (code === 'SLOW_DOWN' || (result.response.status === 429 && code === 'AGENT_SETUP_RATE_LIMITED')) {
      interval = Math.min(600, Math.max(interval + 5, Number(result.response.headers.get('retry-after')) || 0));
      continue;
    }
    if (code === 'ACCESS_DENIED') throw new DeviceSetupError(code, 'Authorization was declined. No configuration was written.');
    if (code === 'EXPIRED_TOKEN') break;
    throw new DeviceSetupError('AUTHORIZATION_FAILED', 'Authorization could not be completed. Start a new request.');
  }
  throw new DeviceSetupError('AUTHORIZATION_EXPIRED', 'The device code expired. Run the command again.');
}

async function main() {
  try {
    const { values } = parseArgs({ options: { device: { type: 'boolean' }, portal: { type: 'string' }, help: { type: 'boolean' } }, strict: true });
    if (values.help) { console.log('npm run configure -- --device\nAuthorize this project in your browser and configure its local .env.'); return; }
    await configureDevice({ portal: values.portal, progress: (message) => console.log(message) });
  } catch (error) {
    console.error(error instanceof DeviceSetupError ? error.message : 'Agent setup failed. Try again.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
