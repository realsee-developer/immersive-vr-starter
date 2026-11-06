import { StarterError } from "./errors.ts";

export interface ServerConfig {
  mode: "demo" | "team";
  port: number;
  vitePort: number;
  dev: boolean;
  gateway: string;
  appKey: string;
  appSecret: string;
  teamSource: string;
}

function readPort(raw: string | undefined, fallback: number) {
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return value;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  if (
    env.REALSEE_MODE &&
    env.REALSEE_MODE !== "demo" &&
    env.REALSEE_MODE !== "team"
  ) {
    throw new Error("REALSEE_MODE must be demo or team");
  }
  let gateway: URL;
  try {
    gateway = new URL(
      env.REALSEE_GATEWAY_BASE_URL?.trim() || "https://app-gateway.realsee.ai"
    );
  } catch {
    // URL's native TypeError includes its raw input, which can contain a
    // mistakenly pasted secret. Replace it before startup writes to stderr.
    throw new Error("REALSEE_GATEWAY_BASE_URL must be an HTTPS origin");
  }
  if (
    gateway.protocol !== "https:" ||
    gateway.username ||
    gateway.password ||
    gateway.search ||
    gateway.hash ||
    gateway.pathname !== "/"
  ) {
    throw new Error("REALSEE_GATEWAY_BASE_URL must be an HTTPS origin");
  }
  return {
    mode: env.REALSEE_MODE === "team" ? "team" : "demo",
    port: readPort(env.PORT, 4101),
    vitePort: readPort(env.VITE_PORT, 5173),
    dev: env.REALSEE_STARTER_DEV === "1",
    gateway: gateway.origin,
    appKey: env.REALSEE_APP_KEY?.trim() || "",
    appSecret: env.REALSEE_APP_SECRET?.trim() || "",
    teamSource: env.REALSEE_TEAM_SOURCE?.trim() || "",
  };
}

export function teamConfigured(config: ServerConfig) {
  return Boolean(config.appKey && config.appSecret && config.teamSource);
}

export function requireTeamConfig(config: ServerConfig) {
  if (!teamConfigured(config)) {
    throw new StarterError(
      503,
      "TEAM_NOT_CONFIGURED",
      "configuration",
      "Set REALSEE_APP_KEY, REALSEE_APP_SECRET, and REALSEE_TEAM_SOURCE in the local .env file, then restart the server. The public demo remains available."
    );
  }
}
