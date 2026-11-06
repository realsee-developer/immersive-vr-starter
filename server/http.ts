import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ServerConfig } from "./config.ts";
import { teamConfigured } from "./config.ts";
import type { createGateway } from "./gateway.ts";
import { StarterError } from "./errors.ts";
import { createSelectionStore } from "./selection.ts";

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(JSON.stringify(body));
}

function requireLocalRequest(request: IncomingMessage, config: ServerConfig) {
  const localPort = request.socket.localPort;
  const hosts = [`127.0.0.1:${localPort}`, `localhost:${localPort}`];
  if (!request.headers.host || !hosts.includes(request.headers.host)) {
    throw new StarterError(
      403,
      "LOCAL_REQUEST_REQUIRED",
      "request",
      "Open this starter at its local 127.0.0.1 address."
    );
  }
  const origins = hosts.map((host) => `http://${host}`);
  if (config.dev)
    origins.push(
      `http://127.0.0.1:${config.vitePort}`,
      `http://localhost:${config.vitePort}`
    );
  if (
    (request.headers.origin && !origins.includes(request.headers.origin)) ||
    request.headers["sec-fetch-site"] === "cross-site"
  ) {
    throw new StarterError(
      403,
      "ORIGIN_REJECTED",
      "request",
      "Use this starter from its local page. Cross-origin API access is disabled."
    );
  }
}

async function readBody(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    throw new StarterError(
      415,
      "JSON_REQUIRED",
      "request",
      "Send a JSON request body."
    );
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as string);
    size += buffer.length;
    if (size <= 4096) chunks.push(buffer);
  }
  if (size > 4096)
    throw new StarterError(
      413,
      "BODY_TOO_LARGE",
      "request",
      "The selection request is too large."
    );
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("invalid");
    return body as Record<string, unknown>;
  } catch {
    throw new StarterError(
      400,
      "INVALID_JSON",
      "request",
      "Send a valid JSON object."
    );
  }
}

function pagination(url: URL) {
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "12");
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 24
  ) {
    throw new StarterError(
      400,
      "INVALID_PAGINATION",
      "request",
      "Use page >= 1 and pageSize between 1 and 24."
    );
  }
  return { page, pageSize };
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wasm": "application/wasm",
};

export function createStarterServer(
  config: ServerConfig,
  gateway: ReturnType<typeof createGateway>,
  publicRoot = resolve(import.meta.dirname, "../client")
) {
  const selections = createSelectionStore(config.teamSource);
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        requireLocalRequest(request, config);
        if (url.pathname === "/api/config" && request.method === "GET") {
          return json(response, 200, {
            data: { mode: config.mode, teamConfigured: teamConfigured(config) },
          });
        }
        if (url.pathname === "/api/team/vrs" && request.method === "GET") {
          const { page, pageSize } = pagination(url);
          const result = await gateway.list(page, pageSize);
          return json(response, 200, {
            data: {
              ...result,
              list: result.list.map((vr) => ({
                ...vr,
                sceneHandle: selections.issue(vr.resourceCode),
              })),
            },
          });
        }
        if (url.pathname === "/api/team/work" && request.method === "POST") {
          const input = await readBody(request);
          const resourceCode = selections.verify(input.sceneHandle);
          return json(response, 200, {
            data: { work: await gateway.work(resourceCode) },
          });
        }
        return json(response, 404, {
          error: {
            code: "NOT_FOUND",
            stage: "request",
            message: "This API route or method is not available.",
          },
        });
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { allow: "GET, HEAD" });
        response.end();
        return;
      }
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        response.writeHead(400);
        response.end("Invalid URL");
        return;
      }
      const file = resolve(
        publicRoot,
        `.${pathname === "/" ? "/index.html" : pathname}`
      );
      if (!file.startsWith(`${publicRoot}${sep}`)) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      try {
        if (!(await stat(file)).isFile()) throw new Error("not-file");
        const content = await readFile(file);
        response.writeHead(200, {
          "content-type":
            mimeTypes[extname(file)] || "application/octet-stream",
          "x-content-type-options": "nosniff",
          "cache-control":
            extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
        });
        response.end(request.method === "HEAD" ? undefined : content);
      } catch {
        response.writeHead(404, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end(
          config.dev
            ? "Open the Vite URL printed by npm run dev."
            : "Not found. Run npm run build before npm start."
        );
      }
    })().catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      if (error instanceof StarterError)
        json(response, error.status, { error: error.publicError });
      else
        json(response, 500, {
          error: {
            code: "LOCAL_SERVER_ERROR",
            stage: "request",
            message:
              "The local server could not complete this request. Restart it and try again.",
          },
        });
    });
  });
  server.requestTimeout = 20_000;
  return server;
}
