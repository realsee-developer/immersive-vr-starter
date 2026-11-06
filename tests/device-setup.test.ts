import assert from 'node:assert/strict';
import { createCipheriv, publicEncrypt, randomBytes, constants } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { parseEnv } from 'node:util';
import { configureDevice, portalOrigin, readEnvironment, writeEnvironment } from '../scripts/configure-device.ts';

const directories: string[] = [];
const config = { appKey: 'test-app-key', appSecret: 'fixture-secret#with spaces', teamSource: 'T-FIXTURE', gatewayBaseUrl: 'https://app-gateway.realsee.ai' };
const deviceCode = 'd'.repeat(43);
const userCode = 'ABCD-EFGH';
const portal = 'http://127.0.0.1:4199';

afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'realsee-device-test-'));
  directories.push(path);
  await writeFile(join(path, '.env.example'), '# local config\nPORT=4101\nREALSEE_APP_KEY=\nREALSEE_APP_SECRET=\nREALSEE_TEAM_SOURCE=\n');
  return path;
}

function encrypt(publicKey: string, value: unknown) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return {
    version: 1, algorithm: 'RSA-OAEP-256+A256GCM',
    encryptedKey: publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64url'),
    iv: iv.toString('base64url'), authTag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url')
  };
}

function deviceFixture(options: { errors?: string[]; payload?: unknown; link?: string; beforeDelivery?: () => Promise<void>; tamper?: boolean } = {}) {
  let key = '';
  let polls = 0;
  let requests = 0;
  let clock = 0;
  const waits: number[] = [];
  const progress: string[] = [];
  const request: typeof fetch = async (input, init) => {
    requests++;
    const url = String(input);
    assert.equal(init?.redirect, 'error');
    assert.ok(!url.includes(deviceCode));
    if (url.endsWith('/device')) {
      key = JSON.parse(String(init?.body)).publicKey;
      assert.match(key, /BEGIN PUBLIC KEY/u);
      return Response.json({ data: { deviceCode, userCode, expiresIn: 600, interval: 5, verificationUriComplete: options.link || `${portal}/agent/setup?user_code=${userCode}` } });
    }
    assert.ok(url.endsWith('/poll'));
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${deviceCode}`);
    const error = options.errors?.[polls++];
    if (error) return Response.json({ error: { code: error } }, { status: error === 'AGENT_SETUP_RATE_LIMITED' ? 429 : 400, headers: ['SLOW_DOWN', 'AGENT_SETUP_RATE_LIMITED'].includes(error) ? { 'retry-after': '15' } : {} });
    await options.beforeDelivery?.();
    const payload = encrypt(key, options.payload || config);
    if (options.tamper) payload.authTag = randomBytes(16).toString('base64url');
    return Response.json({ data: payload });
  };
  return {
    request, progress, waits, requestCount: () => requests,
    now: () => clock, wait: async (ms: number) => { waits.push(ms); clock += ms; }
  };
}

test('device authorization polls, decrypts in the client, and saves only a private local environment file', async () => {
  const path = await directory();
  const fixture = deviceFixture({ errors: ['AUTHORIZATION_PENDING', 'SLOW_DOWN'] });
  const result = await configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait, progress: (message) => fixture.progress.push(message) });
  assert.equal(result.status, 'configured');
  const text = await readFile(join(path, '.env'), 'utf8');
  const env = parseEnv(text);
  assert.equal(env.REALSEE_APP_KEY, config.appKey);
  assert.equal(env.REALSEE_APP_SECRET, config.appSecret);
  assert.equal(env.REALSEE_TEAM_SOURCE, config.teamSource);
  assert.equal(env.REALSEE_GATEWAY_BASE_URL, config.gatewayBaseUrl);
  assert.equal(env.REALSEE_MODE, 'team');
  assert.equal(env.PORT, '4101');
  assert.deepEqual(fixture.waits, [5000, 5000, 15000]);
  assert.ok(fixture.progress.join('\n').includes(userCode));
  for (const secret of [config.appSecret, deviceCode]) assert.ok(!fixture.progress.join('\n').includes(secret));
  if (process.platform !== 'win32') assert.equal((await stat(join(path, '.env'))).mode & 0o777, 0o600);
});

test('device authorization accepts the official test gateway and preserves matching local gateway configuration', async () => {
  const gatewayBaseUrl = 'https://app-gateway.autoenv.realsee.com';
  for (const original of [null, `REALSEE_GATEWAY_BASE_URL=${gatewayBaseUrl}\n`]) {
    const path = await directory();
    if (original !== null) await writeFile(join(path, '.env'), original);
    const fixture = deviceFixture({ payload: { ...config, gatewayBaseUrl } });
    const result = await configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait });
    assert.equal(result.status, 'configured');
    const env = parseEnv(await readFile(join(path, '.env'), 'utf8'));
    assert.equal(env.REALSEE_GATEWAY_BASE_URL, gatewayBaseUrl);
    assert.equal(env.REALSEE_APP_KEY, config.appKey);
    assert.equal(env.REALSEE_APP_SECRET, config.appSecret);
    assert.equal(env.REALSEE_TEAM_SOURCE, config.teamSource);
  }
});

test('existing complete credentials are preserved without contacting the service', async () => {
  const path = await directory();
  const original = 'REALSEE_APP_KEY=old\nREALSEE_APP_SECRET=old-secret\nREALSEE_TEAM_SOURCE=T-OLD\n';
  await writeFile(join(path, '.env'), original);
  const fixture = deviceFixture();
  const result = await configureDevice({ directory: path, portal, fetch: fixture.request });
  assert.equal(result.status, 'existing');
  assert.equal(fixture.requestCount(), 0);
  assert.equal(await readFile(join(path, '.env'), 'utf8'), original);
});

test('temporary service rate limits preserve the pending authorization and respect Retry-After', async () => {
  const path = await directory();
  const fixture = deviceFixture({ errors: ['AGENT_SETUP_RATE_LIMITED', 'AUTHORIZATION_PENDING'] });
  const result = await configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait });
  assert.equal(result.status, 'configured');
  assert.deepEqual(fixture.waits, [5000, 15000, 15000]);
});

test('partial credentials cannot be silently mixed with another app', async () => {
  const path = await directory();
  const original = 'REALSEE_APP_KEY=existing\n';
  await writeFile(join(path, '.env'), original);
  const fixture = deviceFixture();
  await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request }), { code: 'PARTIAL_CONFIGURATION' });
  assert.equal(fixture.requestCount(), 0);
  assert.equal(await readFile(join(path, '.env'), 'utf8'), original);
});

test('a configured gateway cannot receive credentials intended for the official gateway', async () => {
  const path = await directory();
  await writeFile(join(path, '.env'), 'REALSEE_GATEWAY_BASE_URL=https://other.invalid\n');
  await assert.rejects(configureDevice({ directory: path, portal }), { code: 'GATEWAY_CONFLICT' });
  assert.equal((await readEnvironment(path))?.includes('APP_SECRET'), false);
});

test('credentials for one official gateway cannot replace the other gateway configuration', async () => {
  for (const [existingGateway, gatewayBaseUrl] of [
    ['https://app-gateway.realsee.ai', 'https://app-gateway.autoenv.realsee.com'],
    ['https://app-gateway.autoenv.realsee.com', 'https://app-gateway.realsee.ai']
  ]) {
    const path = await directory();
    const original = `REALSEE_GATEWAY_BASE_URL=${existingGateway}\n`;
    await writeFile(join(path, '.env'), original);
    const fixture = deviceFixture({ payload: { ...config, gatewayBaseUrl } });
    await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait }), { code: 'GATEWAY_CONFLICT' });
    assert.equal(await readFile(join(path, '.env'), 'utf8'), original);
  }
});

test('changes made while the user authorizes remain untouched', async () => {
  const path = await directory();
  const changed = 'PORT=4999\n# edited while authorizing\n';
  const fixture = deviceFixture({ beforeDelivery: () => writeFile(join(path, '.env'), changed) });
  await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait }), { code: 'ENV_CHANGED' });
  assert.equal(await readFile(join(path, '.env'), 'utf8'), changed);
});

test('symlinks are refused and their targets are never changed', async () => {
  const path = await directory();
  const target = join(path, 'other-file');
  await writeFile(target, 'keep this');
  await symlink(target, join(path, '.env'));
  await assert.rejects(configureDevice({ directory: path, portal }), { code: 'UNSAFE_ENV_FILE' });
  assert.equal(await readFile(target, 'utf8'), 'keep this');
});

test('denied and expired requests write no configuration', async () => {
  for (const [error, expected] of [['ACCESS_DENIED', 'ACCESS_DENIED'], ['EXPIRED_TOKEN', 'AUTHORIZATION_EXPIRED'], ['ALREADY_CLAIMED', 'AUTHORIZATION_FAILED']]) {
    const path = await directory();
    const fixture = deviceFixture({ errors: [error!] });
    await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait }), { code: expected });
    assert.equal(await readEnvironment(path), null);
  }
});

test('tampered ciphertext, newlines, and a substituted gateway are refused before a file is written', async () => {
  for (const options of [{ tamper: true }, { payload: { ...config, appSecret: 'one\nINJECTED=value' } }, { payload: { ...config, gatewayBaseUrl: 'https://other.invalid' } }]) {
    const path = await directory();
    const fixture = deviceFixture(options);
    await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait }), { code: 'INVALID_CONFIGURATION' });
    assert.equal(await readEnvironment(path), null);
  }
});

test('decrypted gateway configuration only accepts the two exact official HTTPS origins', async () => {
  for (const gatewayBaseUrl of [
    'https://app-gateway.realsee.ai.attacker.invalid',
    'https://app-gateway.autoenv.realsee.com.attacker.invalid',
    'https://app-gateway-autoenv.realsee.com',
    'https://app-gateway.realsee.ai@attacker.invalid',
    'https://user:password@app-gateway.autoenv.realsee.com',
    'https://app-gateway.realsee.ai/',
    'https://app-gateway.autoenv.realsee.com/api',
    'https://app-gateway.realsee.ai?target=other',
    'https://app-gateway.autoenv.realsee.com#other',
    'https://app-gateway.realsee.ai:8443',
    'http://app-gateway.autoenv.realsee.com',
    '//app-gateway.realsee.ai'
  ]) {
    const path = await directory();
    const fixture = deviceFixture({ payload: { ...config, gatewayBaseUrl } });
    await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request, now: fixture.now, wait: fixture.wait }), { code: 'INVALID_CONFIGURATION' });
    assert.equal(await readEnvironment(path), null);
  }
});

test('an unrelated verification page cannot collect authorization', async () => {
  const path = await directory();
  const fixture = deviceFixture({ link: `https://other.invalid/agent/setup?user_code=${userCode}` });
  await assert.rejects(configureDevice({ directory: path, portal, fetch: fixture.request }), { code: 'INVALID_DEVICE_RESPONSE' });
  assert.equal(fixture.requestCount(), 1);
});

test('environment updates preserve unrelated values and values are parsed exactly by Node', async () => {
  const path = await directory();
  const original = 'PORT=4999\nVITE_PORT=5888\nREALSEE_APP_SECRET=\nREALSEE_APP_SECRET=\n';
  await writeFile(join(path, '.env'), original);
  await writeEnvironment(path, { ...config, appSecret: 'a $variable # and "quotes"' }, original);
  const written = await readFile(join(path, '.env'), 'utf8');
  assert.equal(written.match(/^REALSEE_APP_SECRET=/gmu)?.length, 1);
  assert.equal(parseEnv(written).REALSEE_APP_SECRET, 'a $variable # and "quotes"');
  assert.equal(parseEnv(written).PORT, '4999');
  assert.equal(parseEnv(written).VITE_PORT, '5888');
});

test('only the official portal or explicit loopback development servers are accepted', () => {
  assert.equal(portalOrigin(), 'https://developer.realsee.ai');
  assert.equal(portalOrigin('https://developer.preline.realsee.ai'), 'https://developer.preline.realsee.ai');
  assert.equal(portalOrigin('https://local.developer.realsee.ai:8443'), 'https://local.developer.realsee.ai:8443');
  assert.equal(portalOrigin(portal), portal);
  for (const url of ['http://developer.realsee.ai', 'https://other.invalid', 'https://developer.realsee.ai/other', 'https://x@developer.realsee.ai', 'http://local.developer.realsee.ai:8443', 'https://local.developer.realsee.ai:8444']) {
    assert.throws(() => portalOrigin(url), { code: 'INVALID_PORTAL' });
  }
});
