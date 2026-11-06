import { describe, expect, it, vi } from "vitest";
import { clientIp, createRateLimiter, withRateLimit } from "./rate-limit";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter (token bucket)", () => {
  it("allows `limit` requests in a burst, then refuses with a Retry-After", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 60, windowMs: 60_000, now: c.now });
    for (let i = 0; i < 60; i++) expect(limiter.check("1.2.3.4").allowed, `request ${i + 1}`).toBe(true);
    const refused = limiter.check("1.2.3.4");
    expect(refused).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
  });

  it("refills at limit/window: one token per second for 60/min", () => {
    const c = clock();
    const limiter = createRateLimiter({ limit: 60, windowMs: 60_000, now: c.now });
    for (let i = 0; i < 60; i++) limiter.check("ip");
    expect(limiter.check("ip").allowed).toBe(false);
    c.advance(1_000);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(false);
    c.advance(60_000);
    expect(limiter.check("ip").remaining).toBe(59); // full again, never above the limit
  });

  it("keeps a separate bucket per key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock().now });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("bounds memory: evicts the least recently seen keys beyond maxKeys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3, now: clock().now });
    for (const key of ["a", "b", "c"]) limiter.check(key);
    limiter.check("a"); // a is now the most recent
    limiter.check("d"); // evicts b
    expect(limiter.size()).toBe(3);
    expect(limiter.check("a").allowed).toBe(false); // still tracked
    expect(limiter.check("b").allowed).toBe(true); // was evicted, starts fresh
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("https://x.test/api/timings", { headers });

  it("prefers x-real-ip, then x-vercel-forwarded-for, then the first x-forwarded-for entry", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(req({ "x-vercel-forwarded-for": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toBe("8.8.8.8");
    expect(clientIp(req({ "x-forwarded-for": " 1.1.1.1 , 10.0.0.1" }))).toBe("1.1.1.1");
  });

  it("is null for a direct connection (no proxy headers)", () => {
    expect(clientIp(req({}))).toBeNull();
  });
});

describe("withRateLimit", () => {
  const req = (ip?: string) =>
    new Request("https://x.test/api/timings", { headers: ip ? { "x-real-ip": ip } : {} });

  it("runs the handler while under the limit, then answers 429 without calling it", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock().now });
    const handler = vi.fn(async () => new Response("ok"));
    expect((await withRateLimit(limiter, req("1.2.3.4"), handler)).status).toBe(200);
    expect((await withRateLimit(limiter, req("1.2.3.4"), handler)).status).toBe(200);
    const limited = await withRateLimit(limiter, req("1.2.3.4"), handler);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    expect(await limited.json()).toEqual({ ok: false, error: "rate_limited" });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not limit requests without a platform client IP (local Node server, e2e)", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock().now });
    const handler = vi.fn(async () => new Response("ok"));
    for (let i = 0; i < 5; i++) expect((await withRateLimit(limiter, req(), handler)).status).toBe(200);
    expect(limiter.size()).toBe(0);
  });
});
