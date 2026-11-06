import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` hits per window per key, then blocks until the window passes", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("a", 10)).toBe(true);
    expect(rl.hit("a", 20)).toBe(false);
    expect(rl.hit("b", 20)).toBe(true); // separate key
    expect(rl.hit("a", 1000)).toBe(true); // new window
  });

  it("keeps memory bounded by dropping the oldest key", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    rl.hit("a", 0);
    rl.hit("b", 0);
    rl.hit("c", 0); // evicts "a"
    expect(rl.hit("a", 1)).toBe(true);
    expect(rl.hit("c", 1)).toBe(false);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("https://app.example/", { headers });
  it("uses the first x-forwarded-for entry, then x-real-ip, then a shared bucket", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(req({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(req({}))).toBe("unknown");
  });
});
