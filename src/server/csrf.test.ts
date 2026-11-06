import { describe, expect, it, vi } from "vitest";

// Regression guard for src/start.ts: the CSRF middleware must run first, for every server function and every
// mutating (non GET/HEAD/OPTIONS) server-route request except the exempt cron route and Stripe webhook.
// Unfiltered it returns 403 to webhooks; missing, cross-site calls carry the session cookie.
const clerkMarker = vi.hoisted(() => ({ clerk: true }));
vi.mock("@clerk/tanstack-react-start/server", () => ({ clerkMiddleware: () => clerkMarker }));

import { CSRF_EXEMPT_PATHS, startInstance } from "@/start";
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

  // Cross-site variants a browser (or a forged form/fetch) can send along with the user's cookies.
  const CROSS_SITE = [
    { Origin: "https://evil.example", Cookie: "__session=x" },
    { "Sec-Fetch-Site": "cross-site", Cookie: "__session=x" },
    { "Sec-Fetch-Site": "same-site", Cookie: "__session=x" },
    { Cookie: "__session=x" }, // no Origin, Sec-Fetch-Site or Referer
    { Referer: "https://evil.example/page", Cookie: "__session=x" },
  ] as Record<string, string>[];
  const SAME_ORIGIN = [
    { "Sec-Fetch-Site": "same-origin" },
    { Origin: ORIGIN },
    { Referer: `${ORIGIN}/settings` },
  ] as Record<string, string>[];
  const MUTATING_ROUTES: Array<[string, string]> = [
    ["POST", "/api/push/subscribe"],
    ["POST", "/api/announcements"],
    ["PATCH", "/api/announcements/44444444-4444-4444-8444-444444444444"],
    ["DELETE", "/api/announcements/44444444-4444-4444-8444-444444444444"],
    // Donation checkout and portal: same-origin calls from /support, never exempt.
    ["POST", "/api/donations/checkout"],
    ["POST", "/api/donations/portal"],
    // Spelling variants the router may still match must not slip past the check.
    ["POST", "/API/push/subscribe"],
    ["POST", "/api/push/subscribe/"],
    ["PUT", "/api/announcements"],
  ];

  it("rejects cross-site mutating requests to cookie-authenticated API routes", async () => {
    for (const [method, path] of MUTATING_ROUTES) {
      for (const headers of CROSS_SITE) {
        await expectRejected(await runCsrf("router", `${ORIGIN}${path}`, { method, headers, body: "{}" }));
      }
    }
  });

  it("lets same-origin mutating requests to API routes through", async () => {
    for (const [method, path] of MUTATING_ROUTES) {
      for (const headers of SAME_ORIGIN) {
        const { next } = await runCsrf("router", `${ORIGIN}${path}`, { method, headers, body: "{}" });
        expect(next).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("does not check GET/HEAD/OPTIONS on server routes (public APIs, cron GET, OAuth callback)", async () => {
    for (const [method, path] of [
      ["GET", "/api/quran"],
      ["HEAD", "/api/quran"],
      ["OPTIONS", "/api/announcements"],
      ["GET", "/api/announcements"],
      ["GET", "/api/push/dispatch"],
      ["GET", "/api/calendar/google/callback?code=x&state=y"],
    ]) {
      for (const headers of CROSS_SITE) {
        const { next } = await runCsrf("router", `${ORIGIN}${path}`, { method, headers });
        expect(next).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("exempts the secret-authenticated cron route (POST, cross-site, no cookie)", async () => {
    for (const path of ["/api/push/dispatch", "/api/push/dispatch/"]) {
      for (const headers of [
        { Origin: "https://stripe.com" },
        { "Sec-Fetch-Site": "cross-site" },
        { Authorization: "Bearer fake-test-secret" },
        {},
      ] as Record<string, string>[]) {
        const { next } = await runCsrf("router", `${ORIGIN}${path}`, { method: "POST", headers, body: "{}" });
        expect(next).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("the exemption list is exactly the cron route and the signature-verified Stripe webhook", () => {
    expect([...CSRF_EXEMPT_PATHS].sort()).toEqual(["/api/push/dispatch", "/api/stripe/webhook"]);
  });

  it("donation checkout and portal stay origin-checked", async () => {
    for (const path of ["/api/donations/checkout", "/api/donations/portal"]) {
      await expectRejected(
        await runCsrf("router", `${ORIGIN}${path}`, { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }),
      );
    }
  });

  it("an exemption is exact: neighbours and spelling variants of exempt paths are still checked", async () => {
    for (const path of ["/api/push/dispatch/x", "/api/push/dispatchx", "/API/push/dispatch", "/api/stripe/webhook/x", "/api/stripe/webhookx", "/api/stripe"]) {
      await expectRejected(
        await runCsrf("router", `${ORIGIN}${path}`, { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }),
      );
    }
  });
});
