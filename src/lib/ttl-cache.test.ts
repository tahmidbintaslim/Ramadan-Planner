import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FETCH_TIMEOUT_MS, FetchTimeoutError, cachedFetch, clearTtlCache, ttlCache } from "./ttl-cache";

beforeEach(() => {
  vi.useFakeTimers();
  clearTtlCache();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ttlCache", () => {
  it("serves a hit within the TTL without loading again", async () => {
    const load = vi.fn().mockResolvedValue("a");
    expect(await ttlCache("k", 1000, load)).toBe("a");
    vi.advanceTimersByTime(999);
    expect(await ttlCache("k", 1000, load)).toBe("a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after the TTL has passed", async () => {
    const load = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    expect(await ttlCache("k", 1000, load)).toBe("a");
    vi.advanceTimersByTime(1001);
    expect(await ttlCache("k", 1000, load)).toBe("b");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent callers", async () => {
    let resolve!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const p1 = ttlCache("k", 1000, load);
    const p2 = ttlCache("k", 1000, load);
    resolve("x");
    expect(await Promise.all([p1, p2])).toEqual(["x", "x"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejected load, and concurrent callers all see the rejection", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const p1 = ttlCache("k", 1000, load);
    const p2 = ttlCache("k", 1000, load);
    await expect(p1).rejects.toThrow("boom");
    await expect(p2).rejects.toThrow("boom");
    expect(await ttlCache("k", 1000, load)).toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a synchronous throw in load is a rejection, not cached", async () => {
    const load = vi.fn(() => {
      throw new Error("sync");
    });
    await expect(ttlCache("k", 1000, load)).rejects.toThrow("sync");
    await expect(ttlCache("k", 1000, load)).rejects.toThrow("sync");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keys are independent", async () => {
    expect(await ttlCache("a", 1000, async () => 1)).toBe(1);
    expect(await ttlCache("b", 1000, async () => 2)).toBe(2);
  });

  it("evicts the oldest entry once the max-entries bound is exceeded", async () => {
    const loads = { a: vi.fn(async () => "a"), b: vi.fn(async () => "b"), c: vi.fn(async () => "c") };
    await ttlCache("a", 60_000, loads.a, 2);
    await ttlCache("b", 60_000, loads.b, 2);
    await ttlCache("c", 60_000, loads.c, 2); // evicts "a"
    await ttlCache("b", 60_000, loads.b, 2);
    await ttlCache("c", 60_000, loads.c, 2);
    expect(loads.b).toHaveBeenCalledTimes(1);
    expect(loads.c).toHaveBeenCalledTimes(1);
    await ttlCache("a", 60_000, loads.a, 2);
    expect(loads.a).toHaveBeenCalledTimes(2);
  });

  it("drops expired entries when a new key is added", async () => {
    await ttlCache("old", 100, async () => 1, 2);
    vi.advanceTimersByTime(200);
    await ttlCache("n1", 60_000, async () => 2, 2);
    await ttlCache("n2", 60_000, async () => 3, 2);
    // "old" was expired and evicted first, so the live entries survive within the bound of 2.
    const load = vi.fn(async () => 9);
    await ttlCache("n1", 60_000, load, 2);
    await ttlCache("n2", 60_000, load, 2);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("cachedFetch", () => {
  function stubFetch(...responses: Array<{ status: number; body?: unknown }>) {
    const fn = vi.fn();
    for (const r of responses) {
      fn.mockResolvedValueOnce({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        statusText: r.status === 200 ? "OK" : "Err",
        json: async () => r.body,
      });
    }
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("caches a successful response for the TTL (in seconds) and hands out copies", async () => {
    const fetchFn = stubFetch({ status: 200, body: { a: [1] } }, { status: 200, body: { a: [2] } });
    const first = await cachedFetch("https://x/y?z=1", 10);
    expect(first.ok).toBe(true);
    const data = await first.json<{ a: number[] }>();
    data.a.push(99); // mutating one caller's copy must not leak into the cache
    expect(await (await cachedFetch("https://x/y?z=1", 10)).json()).toEqual({ a: [1] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_001);
    expect(await (await cachedFetch("https://x/y?z=1", 10)).json()).toEqual({ a: [2] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("keys by URL, so a different query is a different entry", async () => {
    const fetchFn = stubFetch({ status: 200, body: 1 }, { status: 200, body: 2 });
    expect(await (await cachedFetch("https://x/y?z=1", 10)).json()).toBe(1);
    expect(await (await cachedFetch("https://x/y?z=2", 10)).json()).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns a non-2xx answer to the caller but does not remember it", async () => {
    const fetchFn = stubFetch({ status: 503 }, { status: 200, body: "fine" });
    const bad = await cachedFetch("https://x/y", 10);
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(503);
    const good = await cachedFetch("https://x/y", 10);
    expect(good.ok).toBe(true);
    expect(await good.json()).toBe("fine");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("propagates a network error and does not cache it", async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => 1,
    });
    vi.stubGlobal("fetch", fetchFn);
    await expect(cachedFetch("https://x/y", 10)).rejects.toThrow("net");
    expect((await cachedFetch("https://x/y", 10)).ok).toBe(true);
  });

  it("passes an abort signal to fetch and keeps the caller's init", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK", json: async () => 1 });
    vi.stubGlobal("fetch", fetchFn);
    await cachedFetch("https://x/y", 10, { headers: { a: "b" } });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({ a: "b" });
  });

  it("times out a hung upstream that honours the signal: rejects, aborts, and does not cache", async () => {
    let seen: AbortSignal | undefined;
    const hang = (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        seen = init.signal!;
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
      });
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(hang)
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: async () => "fresh" });
    vi.stubGlobal("fetch", fetchFn);

    const first = cachedFetch("https://x/hang", 3600);
    const concurrent = cachedFetch("https://x/hang", 3600); // shares the in-flight entry
    const settled = Promise.allSettled([first, concurrent]);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS - 1);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const [a, b] = await settled;
    expect(a.status).toBe("rejected");
    expect((a as PromiseRejectedResult).reason).toBeInstanceOf(FetchTimeoutError);
    expect(b.status).toBe("rejected");
    expect(seen?.aborted).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Not cached: the next call goes upstream again and succeeds.
    expect(await (await cachedFetch("https://x/hang", 3600)).json()).toBe("fresh");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("times out even when the upstream ignores the abort signal (e.g. a body that never ends)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: () => new Promise(() => {}) })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: async () => 2 });
    vi.stubGlobal("fetch", fetchFn);

    const pending = cachedFetch("https://x/slow-body", 3600);
    const check = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await check;
    expect(await (await cachedFetch("https://x/slow-body", 3600)).json()).toBe(2);
  });

  it("FETCH_TIMEOUT_MS is a sensible bound (seconds, not minutes)", () => {
    expect(FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(FETCH_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });
});
