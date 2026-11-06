import assert from "node:assert/strict";
import {
  createServer,
  request as httpRequest,
  type ServerResponse,
} from "node:http";
import { test } from "node:test";
import { readConfig } from "../server/config.ts";
import { StarterError } from "../server/errors.ts";
import { createGateway } from "../server/gateway.ts";
import { createStarterServer } from "../server/http.ts";
import { createSelectionStore } from "../server/selection.ts";

const fakeSecret = "fixture-secret +&=/?";
const fakeToken = "fixture-raw-token";
const baseConfig = readConfig({
  REALSEE_APP_KEY: "fixture-key +",
  REALSEE_APP_SECRET: fakeSecret,
  REALSEE_TEAM_SOURCE: "fixture-team",
  REALSEE_MODE: "team",
});

interface CapturedRequest {
  path: string;
  method: string | undefined;
  contentType: string | undefined;
  authorization: string | undefined;
  body: string;
  resource: string | null;
}
async function fixture(
  run: (origin: string, requests: CapturedRequest[]) => Promise<void>,
  respond?: (path: string, response: ServerResponse) => boolean
) {
  const requests: CapturedRequest[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += String(chunk);
    const url = new URL(request.url || "/", "http://127.0.0.1");
    requests.push({
      path: url.pathname,
      method: request.method,
      contentType: request.headers["content-type"],
      authorization: request.headers.authorization,
      body,
      resource: url.searchParams.get("resource_code"),
    });
    response.setHeader("content-type", "application/json");
    if (respond?.(url.pathname, response)) return;
    const data =
      url.pathname === "/auth/access_token"
        ? { access_token: fakeToken, expire_at: 2_000_000_000 }
        : url.pathname === "/open/v3/custom/search"
        ? {
            list: [{ resource_code: "fixture-vr +", name: "Fixture room" }],
            total: 25,
            total_pages: 3,
          }
        : { model: { file_url: "fixture-only" }, observers: [] };
    response.end(JSON.stringify({ code: 0, data }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function localServer(
  config: typeof baseConfig,
  gateway: ReturnType<typeof createGateway>,
  run: (origin: string) => Promise<void>
) {
  const server = createStarterServer(config, gateway);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("the published SDK encodes token form, paginated JSON and raw Authorization against real local HTTP", async () => {
  await fixture(async (origin, requests) => {
    const gateway = createGateway({ ...baseConfig, gateway: origin });
    const page = await gateway.list(2, 12);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 12);
    assert.equal(page.total, 25);
    assert.equal(page.totalPages, 3);
    assert.equal(page.list[0]?.resourceCode, "fixture-vr +");
    await gateway.work(page.list[0]!.resourceCode);
    assert.deepEqual(
      requests.map((request) => request.method),
      ["POST", "POST", "GET"]
    );
    assert.equal(requests[0]?.contentType, "application/x-www-form-urlencoded");
    assert.deepEqual(
      Object.fromEntries(new URLSearchParams(requests[0]!.body)),
      { app_key: baseConfig.appKey, app_secret: fakeSecret }
    );
    assert.equal(requests[1]?.contentType, "application/json");
    assert.deepEqual(JSON.parse(requests[1]!.body), {
      source: "fixture-team",
      page: 2,
      page_size: 12,
    });
    assert.equal(requests[1]?.authorization, fakeToken);
    assert.equal(requests[2]?.authorization, fakeToken);
    assert.equal(requests[2]?.path, "/open/v3/vr/info");
    assert.equal(requests[2]?.resource, "fixture-vr +");
    assert.equal(
      requests.filter((request) => request.path === "/auth/access_token")
        .length,
      1
    );
  });
});

test("directory responses without totals preserve unknown counts through the local HTTP API", async () => {
  await fixture(
    async (origin) => {
      await localServer(
        baseConfig,
        createGateway({ ...baseConfig, gateway: origin }),
        async (local) => {
          const response = await fetch(`${local}/api/team/vrs?page=2&pageSize=12`);
          assert.equal(response.status, 200);
          const body = await response.json();
          assert.equal(body.data.page, 2);
          assert.equal(body.data.pageSize, 12);
          assert.equal(body.data.total, null);
          assert.equal(body.data.totalPages, null);
          assert.equal(body.data.list.length, 1);
          assert.equal(body.data.list[0].name, "Fixture room");
          assert.equal(typeof body.data.list[0].sceneHandle, "string");
        }
      );
    },
    (path, response) => {
      if (!path.includes("search")) return false;
      response.end(JSON.stringify({ code: 0, data: { list: [{ resource_code: "fixture-vr", name: "Fixture room" }] } }));
      return true;
    }
  );
});

test("a reported total still determines total pages when total_pages is omitted", async () => {
  await fixture(
    async (origin) => {
      const result = await createGateway({ ...baseConfig, gateway: origin }).list(1, 12);
      assert.equal(result.total, 25);
      assert.equal(result.totalPages, 3);
    },
    (path, response) => {
      if (!path.includes("search")) return false;
      response.end(JSON.stringify({ code: 0, data: { list: [], total: 25 } }));
      return true;
    }
  );
});

test("malformed supplied directory counts are rejected instead of treated as unknown", async () => {
  for (const counts of [
    { total: "25" }, { total: null }, { total: -1 }, { total: 1.5 },
    { total_pages: "3" }, { total_pages: null }, { total_pages: -1 },
  ]) {
    await fixture(
      async (origin) => {
        await assert.rejects(
          createGateway({ ...baseConfig, gateway: origin }).list(1, 12),
          (error: unknown) => error instanceof StarterError && error.publicError.stage === "directory"
        );
      },
      (path, response) => {
        if (!path.includes("search")) return false;
        response.end(JSON.stringify({ code: 0, data: { list: [], ...counts } }));
        return true;
      }
    );
  }
});

test("concurrent reads share token exchange and refresh before Unix-second expiry", async () => {
  await fixture(async (origin, requests) => {
    let time = 1_999_999_000_000;
    const gateway = createGateway(
      { ...baseConfig, gateway: origin },
      { now: () => time }
    );
    await Promise.all([gateway.list(1, 12), gateway.list(2, 12)]);
    assert.equal(
      requests.filter((request) => request.path === "/auth/access_token")
        .length,
      1
    );
    time = 1_999_999_980_000;
    await gateway.list(1, 12);
    assert.equal(
      requests.filter((request) => request.path === "/auth/access_token")
        .length,
      2
    );
  });
});

test("HTTP 200 business failures are rejected at their actual stage without exposing the upstream message", async () => {
  for (const [path, stage] of [
    ["/auth/access_token", "token"],
    ["/open/v3/custom/search", "directory"],
    ["/open/v3/vr/info", "work"],
  ] as const) {
    await fixture(
      async (origin) => {
        const gateway = createGateway({ ...baseConfig, gateway: origin });
        await assert.rejects(
          stage === "work" ? gateway.work("fixture-vr") : gateway.list(1, 12),
          (error: unknown) => {
            assert.ok(error instanceof StarterError);
            assert.equal(error.publicError.stage, stage);
            assert.equal(error.publicError.code, "GATEWAY_UNAVAILABLE");
            assert.ok(!JSON.stringify(error.publicError).includes(fakeSecret));
            assert.ok(!JSON.stringify(error.publicError).includes(fakeToken));
            return true;
          }
        );
      },
      (requestPath, response) => {
        if (requestPath !== path) return false;
        response.end(
          JSON.stringify({
            code: -1,
            status: `sensitive: ${fakeSecret} ${fakeToken}`,
            data: null,
          })
        );
        return true;
      }
    );
  }
});

test("the SDK fetch override enforces an actual network deadline", async () => {
  await fixture(
    async (origin) => {
      const gateway = createGateway(
        { ...baseConfig, gateway: origin },
        { timeoutMs: 25 }
      );
      await assert.rejects(
        gateway.list(1, 12),
        (error: unknown) =>
          error instanceof StarterError && error.publicError.stage === "token"
      );
    },
    () => true
  );
});

test("empty directory is a successful API result, not a scene success", async () => {
  await fixture(
    async (origin) => {
      const page = await createGateway({ ...baseConfig, gateway: origin }).list(
        1,
        12
      );
      assert.deepEqual(page, {
        list: [],
        page: 1,
        pageSize: 12,
        total: 0,
        totalPages: 0,
      });
    },
    (path, response) => {
      if (!path.includes("search")) return false;
      response.end(
        JSON.stringify({
          code: 0,
          data: { list: [], total: 0, total_pages: 0 },
        })
      );
      return true;
    }
  );
});

test("signed selections reject tampering, expiry, and a handle from another process", () => {
  let now = 1000;
  const selections = createSelectionStore("fixture-team", () => now);
  const handle = selections.issue("fixture-vr");
  assert.equal(selections.verify(handle), "fixture-vr");
  assert.throws(() => selections.verify(`${handle}x`), StarterError);
  assert.throws(() => selections.verify("fixture-vr"), StarterError);
  assert.throws(
    () => createSelectionStore("another-team").verify(handle),
    StarterError
  );
  now += 5 * 60 * 1000;
  assert.throws(
    () => selections.verify(handle),
    (error: unknown) =>
      error instanceof StarterError &&
      error.publicError.code === "SELECTION_EXPIRED"
  );
});

test("local HTTP route only resolves Work for a server-listed selection; secrets never appear in responses", async () => {
  await fixture(async (origin, requests) => {
    await localServer(
      baseConfig,
      createGateway({ ...baseConfig, gateway: origin }),
      async (local) => {
        const configResponse = await (
          await fetch(`${local}/api/config`)
        ).json();
        assert.deepEqual(configResponse, {
          data: { mode: "team", teamConfigured: true },
        });
        const denied = await fetch(`${local}/api/team/work`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resourceCode: "not-listed" }),
        });
        assert.equal(denied.status, 403);
        assert.equal(requests.length, 0);
        const directory = await (
          await fetch(`${local}/api/team/vrs?page=2&pageSize=12`)
        ).json();
        const handle = directory.data.list[0].sceneHandle;
        const resolved = await fetch(`${local}/api/team/work`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sceneHandle: handle }),
        });
        assert.equal(resolved.status, 200);
        const body = await resolved.text();
        assert.ok(body.includes('"work"'));
        for (const exposed of [
          JSON.stringify(configResponse),
          JSON.stringify(directory),
          body,
        ]) {
          assert.ok(!exposed.includes(fakeSecret));
          assert.ok(!exposed.includes(fakeToken));
          assert.ok(!exposed.includes("appSecret"));
        }
        assert.equal(requests.at(-1)?.resource, "fixture-vr +");
      }
    );
  });
});

test("missing local configuration is explicit and sends no upstream request", async () => {
  const config = readConfig({});
  const gateway = createGateway(config, {
    fetch: async () => {
      throw new Error("No network request should be made");
    },
  });
  await localServer(config, gateway, async (origin) => {
    const response = await fetch(`${origin}/api/team/vrs`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, "TEAM_NOT_CONFIGURED");
    assert.equal(body.error.stage, "configuration");
  });
});

test("foreign origins, DNS-rebinding hosts, invalid pagination and arbitrary proxy paths are rejected", async () => {
  const config = { ...readConfig({}), dev: true };
  const gateway = createGateway(config);
  await localServer(config, gateway, async (origin) => {
    for (const headers of [
      { origin: "https://foreign.example" },
      { host: "foreign.example" },
      { "sec-fetch-site": "cross-site" },
    ]) {
      // Use node:http so custom Host/Sec-Fetch headers reach the wire unchanged.
      const response = await new Promise<{
        status: number | undefined;
        cors: string | string[] | undefined;
      }>((resolve, reject) => {
        const request = httpRequest(
          `${origin}/api/config`,
          { headers },
          (response) => {
            response.resume();
            resolve({
              status: response.statusCode,
              cors: response.headers["access-control-allow-origin"],
            });
          }
        );
        request.on("error", reject);
        request.end();
      });
      assert.equal(response.status, 403, JSON.stringify(headers));
      assert.equal(response.cors, undefined);
    }
    assert.equal(
      (
        await fetch(`${origin}/api/config`, {
          headers: { origin: "http://127.0.0.1:5173" },
        })
      ).status,
      200
    );
    assert.equal(
      (await fetch(`${origin}/api/team/vrs?pageSize=999`)).status,
      400
    );
    assert.equal(
      (await fetch(`${origin}/api/proxy?url=https://foreign.example`)).status,
      404
    );
    assert.equal((await fetch(`${origin}/.env`)).status, 404);
  });
});

test("runtime configuration rejects credential-bearing gateway URLs and malformed modes", () => {
  assert.throws(() =>
    readConfig({
      REALSEE_GATEWAY_BASE_URL: "https://user:password@example.test",
    })
  );
  assert.throws(() =>
    readConfig({ REALSEE_GATEWAY_BASE_URL: "https://example.test/path" })
  );
  assert.throws(() => readConfig({ REALSEE_MODE: "unexpected" }));
  assert.throws(
    () =>
      readConfig({
        REALSEE_GATEWAY_BASE_URL: "https://fake:fixture-secret@[invalid",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        "REALSEE_GATEWAY_BASE_URL must be an HTTPS origin"
      );
      assert.ok(!JSON.stringify(error).includes("fixture-secret"));
      assert.ok(!error.stack?.includes("fixture-secret"));
      return true;
    }
  );
});
