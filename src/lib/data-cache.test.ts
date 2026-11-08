// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DATA_CACHE_KEY,
  DATA_CACHE_MAX_CHARS,
  fetchCached,
  isFresh,
  peekCached,
  resetDataCacheForTests,
  setCached,
  staleAtFor,
  timetableUrl,
} from "./data-cache";
import { homeRequestUrls } from "@/components/today/use-home-timings";
import type { StoredLocation } from "./user-location";

const TIMINGS = { prayerTimes: { fajr: "05:02" }, timezone: "Asia/Dhaka" };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  resetDataCacheForTests();
});

describe("fetchCached", () => {
  it("shares one request between concurrent callers and answers later ones from memory", async () => {
    const fetchMock = vi.fn(async () => ok(TIMINGS));
    vi.stubGlobal("fetch", fetchMock);
    const url = "/api/timings?tz=Asia%2FDhaka&date=2027-02-20";
    const [a, b] = await Promise.all([fetchCached(url), fetchCached(url)]);
    expect(a).toEqual(TIMINGS);
    expect(b).toBe(a);
    await fetchCached(url);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not keep a failed or unusable answer (the next call retries)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 502 }))
      .mockResolvedValueOnce(ok({ error: "x" }))
      .mockResolvedValueOnce(ok(TIMINGS));
    vi.stubGlobal("fetch", fetchMock);
    const url = "/api/timings?tz=UTC&date=2027-02-20";
    await expect(fetchCached(url)).rejects.toThrow();
    await expect(fetchCached(url)).rejects.toThrow();
    expect(peekCached(url)).toBeUndefined();
    await expect(fetchCached(url)).resolves.toEqual(TIMINGS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keys by calculation params: a method or Hijri adjustment change is a new request", async () => {
    const fetchMock = vi.fn(async (url: string) => ok(url && TIMINGS));
    vi.stubGlobal("fetch", fetchMock);
    const coords = { lat: 23.81, lng: 90.41 };
    const karachi = homeRequestUrls("Asia/Dhaka", "2027-02-20", coords, { cc: "BD", method: "1", school: "1" });
    const isna = homeRequestUrls("Asia/Dhaka", "2027-02-20", coords, { cc: "BD", method: "2", school: "1" });
    const adjusted = homeRequestUrls("Asia/Dhaka", "2027-02-20", coords, { cc: "BD", method: "1", school: "1", hadj: "1" });
    await fetchCached(karachi.today);
    await fetchCached(karachi.today);
    await fetchCached(isna.today);
    await fetchCached(adjusted.today);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([karachi.today, isna.today, adjusted.today]);
  });

  it("uses a custom fetcher (the /quran loader's server function) under the same key", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const list = [{ surahNo: 1 }];
    await expect(fetchCached("/api/quran", async () => list)).resolves.toBe(list);
    await expect(fetchCached("/api/quran")).resolves.toBe(list);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("persistence", () => {
  it("survives a reload (module memory gone) and serves the stored answer without a request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok(TIMINGS)));
    const url = "/api/timings?tz=Asia%2FDhaka&date=2099-01-01";
    await fetchCached(url);
    expect(localStorage.getItem(DATA_CACHE_KEY)).toContain("2099-01-01");

    resetDataCacheForTests(); // a new page: memory empty, storage kept
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(peekCached(url)).toEqual(TIMINGS);
    await expect(fetchCached(url)).resolves.toEqual(TIMINGS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops long-dead entries and a corrupt store", () => {
    localStorage.setItem(
      DATA_CACHE_KEY,
      JSON.stringify({ "/api/timings?date=2001-01-01": { data: TIMINGS, staleAt: Date.parse("2001-01-03"), at: 0 } }),
    );
    expect(peekCached("/api/timings?date=2001-01-01")).toBeUndefined();
    resetDataCacheForTests();
    localStorage.setItem(DATA_CACHE_KEY, "{not json");
    expect(peekCached("/api/quran")).toBeUndefined();
  });

  it("stays under the size cap, evicting the oldest entries first", () => {
    const big = { prayerTimes: { note: "x".repeat(DATA_CACHE_MAX_CHARS / 3) } };
    for (let i = 1; i <= 5; i += 1) setCached(`/api/timings?date=2099-01-0${i}`, big, Date.now() + i);
    const stored = localStorage.getItem(DATA_CACHE_KEY)!;
    expect(stored.length).toBeLessThanOrEqual(DATA_CACHE_MAX_CHARS);
    const keys = Object.keys(JSON.parse(stored));
    expect(keys).toContain("/api/timings?date=2099-01-05");
    expect(keys).not.toContain("/api/timings?date=2099-01-01");
  });
});

describe("staleness", () => {
  it("dated timings stay fresh through their date, then go stale", () => {
    const url = "/api/timings?tz=Asia%2FDhaka&date=2027-02-20";
    const now = Date.parse("2027-02-20T10:00:00Z");
    setCached(url, TIMINGS, now);
    expect(isFresh(url, now)).toBe(true);
    expect(isFresh(url, Date.parse("2027-02-21T20:00:00Z"))).toBe(true);
    expect(isFresh(url, Date.parse("2027-02-22T01:00:00Z"))).toBe(false);
  });

  it("the timetable is kept for the year, or until the day after its last row", () => {
    const now = Date.parse("2026-11-08T00:00:00Z");
    const days = [{ gregorianDate: "08-02-2027" }, { gregorianDate: "09-03-2027" }];
    expect(new Date(staleAtFor("/api/ramadan-timetable?tz=UTC", { days }, now)).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    const during = Date.parse("2027-02-20T00:00:00Z");
    expect(new Date(staleAtFor("/api/ramadan-timetable?tz=UTC", { days }, during)).toISOString()).toBe("2027-03-10T00:00:00.000Z");
  });

  it("timetableUrl spells coordinates and calculation one way", () => {
    const loc = { v: 2, kind: "district", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", country: "BD", method: 1, school: 1, savedAt: "" } as StoredLocation;
    expect(timetableUrl("Asia/Dhaka", loc)).toBe("/api/ramadan-timetable?tz=Asia%2FDhaka&lat=24.90&lng=91.87&cc=BD&method=1&school=1");
    expect(timetableUrl("Asia/Dhaka", null)).toBe("/api/ramadan-timetable?tz=Asia%2FDhaka");
  });
});
