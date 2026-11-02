import { describe, expect, it, vi } from "vitest";

// Regression guard for src/start.ts: the CSRF middleware must run first and only for server functions.
// Unfiltered it returns 403 to webhooks; missing, cross-site server-function calls carry the session cookie.
const clerkMarker = vi.hoisted(() => ({ clerk: true }));
vi.mock("@clerk/tanstack-react-start/server", () => ({ clerkMiddleware: () => clerkMarker }));

import { startInstance } from "@/start";
import { errorMaskMiddleware } from "@/server/error-mask-middleware";

type Ctx = { request: Request; handlerType: "serverFn" | "router"; next: () => unknown };
type Server = (ctx: Ctx) => unknown;

const ORIGIN = "https://app.example";
const FN = `${ORIGIN}/_serverFn/abc`;

async function middlewares() {
  const { requestMiddleware = [] } = await startInstance.getOptions();
  return requestMiddleware as unknown as Array<{ options?: { server?: Server } }>;
}

async function runCsrf(handlerType: Ctx["handlerType"], url: string, init: RequestInit = {}) {
  const [csrf] = await middlewares();
  const next = vi.fn(() => "next");
  const result = await csrf.options!.server!({ request: new Request(url, init), handlerType, next });
  return { result, next };
}

async function expectRejected(r: Awaited<ReturnType<typeof runCsrf>>) {
  expect(r.next).not.toHaveBeenCalled();
  expect(r.result).toBeInstanceOf(Response);
  expect((r.result as Response).status).toBe(403);
}

describe("start.ts CSRF middleware", () => {
  it("is the first request middleware, before Clerk's", async () => {
    const list = await middlewares();
    expect(list).toHaveLength(2);
    expect(list[0]).not.toBe(clerkMarker);
    expect(typeof list[0].options?.server).toBe("function");
    expect(list[1]).toBe(clerkMarker);
  });

  it("registers the error mask as a global FUNCTION middleware (a separate list from the request middleware)", async () => {
    const { functionMiddleware = [] } = await startInstance.getOptions();
    expect(functionMiddleware).toEqual([errorMaskMiddleware]);
    const { requestMiddleware = [] } = await startInstance.getOptions();
    expect(requestMiddleware).not.toContain(errorMaskMiddleware);
  });

  it("rejects a cross-origin server-function POST carrying a session cookie", async () => {
    await expectRejected(
      await runCsrf("serverFn", FN, {
        method: "POST",
        headers: { Origin: "https://evil.example", Cookie: "__session=x" },
      }),
    );
  });

  it("rejects Sec-Fetch-Site: same-site and cross-site", async () => {
    for (const site of ["same-site", "cross-site"]) {
      await expectRejected(await runCsrf("serverFn", FN, { method: "POST", headers: { "Sec-Fetch-Site": site } }));
    }
  });

  it("rejects a server-function POST with no Origin, Sec-Fetch-Site or Referer", async () => {
    await expectRejected(await runCsrf("serverFn", FN, { method: "POST", headers: { Cookie: "__session=x" } }));
  });

  it("rejects a server-function GET with no headers", async () => {
    await expectRejected(await runCsrf("serverFn", FN));
  });

  it("lets a same-origin server-function POST through", async () => {
    for (const headers of [{ "Sec-Fetch-Site": "same-origin" }, { Origin: ORIGIN }] as Record<string, string>[]) {
      const { next } = await runCsrf("serverFn", FN, { method: "POST", headers });
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it("does not block a cross-site webhook POST to a server route", async () => {
    for (const headers of [{ Origin: "https://stripe.com" }, { "Sec-Fetch-Site": "cross-site" }, {}] as Record<string, string>[]) {
      const { next } = await runCsrf("router", `${ORIGIN}/api/webhooks/stripe`, { method: "POST", headers, body: "{}" });
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});
