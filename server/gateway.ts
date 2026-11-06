import { createClient, createCommand } from "@realsee/api";
import type { DiagnosticStage } from "../shared/contracts.ts";
import type { ServerConfig } from "./config.ts";
import { requireTeamConfig } from "./config.ts";
import { StarterError, unavailable } from "./errors.ts";
import { gatewayDefine } from "./gateway-define.ts";

const command = createCommand(["gateway"]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readEnvelope(value: unknown, stage: DiagnosticStage) {
  // The SDK handles HTTP failures, but the gateway also returns business
  // failures as HTTP 200. Never treat those envelopes as successful data.
  if (!record(value) || value.code !== 0 || !record(value.data))
    throw unavailable(stage);
  return value.data;
}

export function createGateway(
  config: ServerConfig,
  options: {
    fetch?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
  } = {}
) {
  const transport = options.fetch || fetch;
  const now = options.now || Date.now;
  const client = createClient(
    { gateway: gatewayDefine },
    {
      remote: {
        gateway: {
          endpoint: config.gateway,
          override: {
            // v0.1.11 does not forward a command Request.signal. Its supported
            // fetch override enforces a deadline on the actual network request.
            fetch: (input, init) =>
              transport(input, {
                ...init,
                signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
              }),
          },
        },
      },
    }
  );
  let token: { value: string; expiresAt: number } | undefined;
  let pendingToken: Promise<string> | undefined;

  async function accessToken() {
    requireTeamConfig(config);
    if (token && token.expiresAt > now() + 30_000) return token.value;
    if (pendingToken) return pendingToken;
    pendingToken = (async () => {
      try {
        const result: unknown = await client.send(
          command.gateway("/auth/access_token").post({
            requestBody: {
              app_key: config.appKey,
              app_secret: config.appSecret,
            },
          })
        );
        const data = readEnvelope(result, "token");
        if (
          typeof data.access_token !== "string" ||
          !data.access_token ||
          typeof data.expire_at !== "number" ||
          !Number.isFinite(data.expire_at) ||
          data.expire_at * 1000 <= now()
        ) {
          throw unavailable("token");
        }
        token = { value: data.access_token, expiresAt: data.expire_at * 1000 };
        return token.value;
      } catch {
        token = undefined;
        throw unavailable("token");
      } finally {
        pendingToken = undefined;
      }
    })();
    return pendingToken;
  }

  async function list(page: number, pageSize: number) {
    const authorization = await accessToken();
    try {
      const result: unknown = await client.send(
        command.gateway("/open/v3/custom/search").post({
          headers: { Authorization: authorization },
          requestBody: { source: config.teamSource, page, page_size: pageSize },
        })
      );
      const data = readEnvelope(result, "directory");
      if (
        !Array.isArray(data.list) ||
        (data.total !== undefined &&
          (typeof data.total !== "number" ||
            !Number.isInteger(data.total) ||
            data.total < 0)) ||
        (data.total_pages !== undefined &&
          (typeof data.total_pages !== "number" ||
            !Number.isInteger(data.total_pages) ||
            data.total_pages < 0))
      )
        throw unavailable("directory");
      const total = typeof data.total === "number" ? data.total : null;
      const list = data.list.map((item: unknown) => {
        if (
          !record(item) ||
          typeof item.resource_code !== "string" ||
          !item.resource_code.trim()
        )
          throw unavailable("directory");
        return {
          resourceCode: item.resource_code.trim(),
          name:
            typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : item.resource_code.trim(),
        };
      });
      return {
        list,
        page,
        pageSize,
        total,
        totalPages:
          typeof data.total_pages === "number"
            ? data.total_pages
            : total !== null
            ? Math.ceil(total / pageSize)
            : null,
      };
    } catch (error) {
      token = undefined;
      if (error instanceof StarterError) throw error;
      throw unavailable("directory");
    }
  }

  async function work(resourceCode: string) {
    const authorization = await accessToken();
    try {
      const result: unknown = await client.send(
        command.gateway("/open/v3/vr/info").get({
          // SDK 0.1.11 joins query values without escaping. Encode this fixed
          // parameter once so a resource containing +, &, or # is not changed.
          headers: { Authorization: authorization },
          parameters: { resource_code: encodeURIComponent(resourceCode) },
        })
      );
      return readEnvelope(result, "work");
    } catch {
      token = undefined;
      throw unavailable("work");
    }
  }

  return { list, work };
}
