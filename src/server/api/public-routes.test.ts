import { beforeEach, describe, expect, it, vi } from "vitest";

// Expected header values copied from the Next handlers in src/app/api/**/route.ts (not from the new constants),
// so a drift in the port fails here.
const NEXT_TIMINGS_CC = "public, s-maxage=3600, stale-while-revalidate=300";
const NEXT_RAMADAN_CC = "public, s-maxage=3600, stale-while-revalidate=300";
const NEXT_TIMETABLE_CC = "public, s-maxage=86400, stale-while-revalidate=604800";
const NEXT_QURAN_CC = "public, s-maxage=604800, stale-while-revalidate=2592000";
const NEXT_DAILY_CC = "public, s-maxage=3600, stale-while-revalidate=86400";

const m = vi.hoisted(() => ({
  fetchPrayerTimes: vi.fn(),
  getRamadanStatus: vi.fn(),
  fetchRamadanTimetable: vi.fn(),
  fetchSurahList: vi.fn(),
  fetchSurah: vi.fn(),
  fetchReciters: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("@/lib/prayer-times", async (orig) => ({
  ...(await orig<typeof import("@/lib/prayer-times")>()),
  fetchPrayerTimes: m.fetchPrayerTimes,
}));
vi.mock("@/lib/ramadan-date", () => ({ getRamadanStatus: m.getRamadanStatus }));
vi.mock("@/lib/ramadan-timetable", () => ({ fetchRamadanTimetable: m.fetchRamadanTimetable }));
vi.mock("@/lib/quran", () => ({
  fetchSurahList: m.fetchSurahList,
  fetchSurah: m.fetchSurah,
  fetchReciters: m.fetchReciters,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { dailyContent: { findUnique: m.findUnique } } }));

import { handleTimings } from "./timings";
import { handleRamadan } from "./ramadan";
import { handleRamadanTimetable } from "./ramadan-timetable";
import { handleQuran } from "./quran";
import { handleDailyContent } from "./daily-content";

const req = (path: string) => new Request(`https://app.example${path}`);
const LEAK = /prisma|127\.0\.0\.1|5432|ECONNREFUSED|secret/i;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/timings", () => {
  it("200 with the data and the Next Cache-Control; Dhaka defaults; ISO date normalized", async () => {
    m.fetchPrayerTimes.mockResolvedValue({ prayerTimes: { fajr: "04:00" } });
    const res = await handleTimings(req("/api/timings?date=2026-03-01"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(NEXT_TIMINGS_CC);
    expect(res.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ prayerTimes: { fajr: "04:00" } });
    expect(m.fetchPrayerTimes).toHaveBeenCalledWith(23.8103, 90.4125, "01-03-2026", "Asia/Dhaka", "ঢাকা, বাংলাদেশ");
  });

  it("uses timezone defaults and explicit params", async () => {
    m.fetchPrayerTimes.mockResolvedValue({});
    await handleTimings(req("/api/timings?tz=Europe/London&date=2026-03-01"));
    expect(m.fetchPrayerTimes).toHaveBeenCalledWith(51.5074, -0.1278, "01-03-2026", "Europe/London", "London, UK");
    await handleTimings(req("/api/timings?tz=Asia/Dhaka&lat=10&lng=20&location=X&date=2026-03-01"));
    expect(m.fetchPrayerTimes).toHaveBeenLastCalledWith(10, 20, "01-03-2026", "Asia/Dhaka", "X");
  });

  it("400 on bad coordinates, 502 on upstream failure (no Cache-Control, as before)", async () => {
    const bad = await handleTimings(req("/api/timings?lat=91&lng=0"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Invalid latitude or longitude" });
    m.fetchPrayerTimes.mockRejectedValue(new Error("upstream secret 127.0.0.1"));
    const down = await handleTimings(req("/api/timings"));
    expect(down.status).toBe(502);
    expect(down.headers.get("Cache-Control")).toBeNull();
    const text = await down.text();
    expect(text).toBe(JSON.stringify({ error: "Failed to fetch prayer times" }));
  });

  it("400 on a bad timezone or date (validated before any upstream call)", async () => {
    for (const q of ["tz=Not/AZone", "tz=", `tz=${"A".repeat(65)}`]) {
      const res = await handleTimings(req(`/api/timings?${q}`));
      expect(res.status, q).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid timezone" });
    }
    for (const q of ["date=01-03-2026", "date=2026-3-1", "date=2026-02-30", "date=today"]) {
      const res = await handleTimings(req(`/api/timings?tz=Asia/Dhaka&${q}`));
      expect(res.status, q).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid date" });
    }
    expect(m.fetchPrayerTimes).not.toHaveBeenCalled();
  });
});

describe("GET /api/ramadan", () => {
  it("200 with status and Cache-Control; passes country and coordinates", async () => {
    m.getRamadanStatus.mockResolvedValue({ isRamadan: false });
    const res = await handleRamadan(req("/api/ramadan?tz=Asia/Dhaka&lat=23.8&lng=90.4&cc=BD"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(NEXT_RAMADAN_CC);
    expect(await res.json()).toEqual({ isRamadan: false });
    expect(m.getRamadanStatus).toHaveBeenCalledWith("Asia/Dhaka", "BD", { latitude: 23.8, longitude: 90.4 });
  });

  it("no coordinates -> undefined; 502 on failure", async () => {
    m.getRamadanStatus.mockResolvedValueOnce({});
    await handleRamadan(req("/api/ramadan"));
    expect(m.getRamadanStatus.mock.calls[0][0]).toBe("Asia/Dhaka");
    expect(m.getRamadanStatus.mock.calls[0][2]).toBeUndefined();
    m.getRamadanStatus.mockRejectedValue(new Error("x"));
    const res = await handleRamadan(req("/api/ramadan"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to fetch Ramadan status" });
  });

  it("accepts the local date (cache key only); 400 on a bad timezone or date", async () => {
    m.getRamadanStatus.mockResolvedValueOnce({});
    const ok = await handleRamadan(req("/api/ramadan?tz=Asia/Dhaka&date=2027-02-20"));
    expect(ok.status).toBe(200);
    expect(m.getRamadanStatus).toHaveBeenCalledWith("Asia/Dhaka", "BD", undefined);
    const tz = await handleRamadan(req("/api/ramadan?tz=Mars/Base"));
    expect(tz.status).toBe(400);
    expect(await tz.json()).toEqual({ error: "Invalid timezone" });
    const date = await handleRamadan(req("/api/ramadan?tz=Asia/Dhaka&date=20-02-2027"));
    expect(date.status).toBe(400);
    expect(await date.json()).toEqual({ error: "Invalid date" });
    expect(m.getRamadanStatus).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/ramadan-timetable", () => {
  it("200 with timetable and Cache-Control", async () => {
    m.fetchRamadanTimetable.mockResolvedValue({ days: [] });
    const res = await handleRamadanTimetable(req("/api/ramadan-timetable?tz=Asia/Karachi&year=1448"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(NEXT_TIMETABLE_CC);
    expect(await res.json()).toEqual({ days: [] });
    expect(m.fetchRamadanTimetable).toHaveBeenCalledWith(24.8607, 67.0011, "1448", "Asia/Karachi", "Karachi, Pakistan");
  });

  it("400 invalid timezone, 400 invalid coordinates, 502 on failure", async () => {
    const tz = await handleRamadanTimetable(req("/api/ramadan-timetable?tz=Bad/Zone"));
    expect(tz.status).toBe(400);
    expect(await tz.json()).toEqual({ error: "Invalid timezone" });
    const coords = await handleRamadanTimetable(req("/api/ramadan-timetable?lat=abc"));
    expect(coords.status).toBe(400);
    expect(await coords.json()).toEqual({ error: "Invalid coordinates" });
    m.fetchRamadanTimetable.mockRejectedValue(new Error("x"));
    const down = await handleRamadanTimetable(req("/api/ramadan-timetable"));
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: "Failed to fetch Ramadan timetable" });
  });
});

describe("GET /api/quran", () => {
  it("surah list, single surah and reciters: 200 with the long Cache-Control", async () => {
    m.fetchSurahList.mockResolvedValue([{ surahNo: 1 }]);
    m.fetchSurah.mockResolvedValue({ surahNo: 2, ayahs: [] });
    m.fetchReciters.mockResolvedValue([{ id: "1" }]);
    for (const [path, body] of [
      ["/api/quran", [{ surahNo: 1 }]],
      ["/api/quran?surah=2", { surahNo: 2, ayahs: [] }],
      ["/api/quran?reciters=true", [{ id: "1" }]],
    ] as const) {
      const res = await handleQuran(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe(NEXT_QURAN_CC);
      expect(await res.json()).toEqual(body);
    }
    expect(m.fetchSurah).toHaveBeenCalledWith(2);
  });

  it("400 for an out-of-range surah (no Cache-Control)", async () => {
    for (const n of ["0", "115", "abc"]) {
      const res = await handleQuran(req(`/api/quran?surah=${n}`));
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBeNull();
      expect(await res.json()).toEqual({
        ok: false,
        error: { code: "invalid_surah", message: "Surah number must be between 1 and 114" },
      });
    }
  });

  it("503 no-store when the data sources are empty or throw; nothing leaks", async () => {
    m.fetchSurahList.mockResolvedValue([]);
    m.fetchSurah.mockResolvedValue(null);
    m.fetchReciters.mockResolvedValue([]);
    const cases: Array<[string, string]> = [
      ["/api/quran", "Surah list is temporarily unavailable"],
      ["/api/quran?surah=1", "Surah is temporarily unavailable"],
      ["/api/quran?reciters=true", "Reciter list is temporarily unavailable"],
    ];
    for (const [path, message] of cases) {
      const res = await handleQuran(req(path));
      expect(res.status).toBe(503);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(await res.json()).toEqual({ ok: false, error: { code: "unavailable", message } });
    }
    m.fetchSurahList.mockRejectedValue(new Error("PrismaClient 127.0.0.1:5432"));
    const res = await handleQuran(req("/api/quran"));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toMatch(LEAK);
    expect(JSON.parse(text).error.message).toBe("Quran data is temporarily unavailable");
  });
});

describe("GET /api/daily-content", () => {
  const row = { day: 3, ayahAr: "a", ayahBn: "b" };

  it("200 with { ok, data } and Cache-Control; default day 1", async () => {
    m.findUnique.mockResolvedValue(row);
    const res = await handleDailyContent(req("/api/daily-content?day=3"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(NEXT_DAILY_CC);
    expect(await res.json()).toEqual({ ok: true, data: row });
    expect(m.findUnique.mock.calls[0][0].where).toEqual({ day: 3 });
    await handleDailyContent(req("/api/daily-content"));
    expect(m.findUnique.mock.calls[1][0].where).toEqual({ day: 1 });
  });

  it("400 invalid_day, 404 not_found, 503 unavailable: all no-store, no leak", async () => {
    const bad = await handleDailyContent(req("/api/daily-content?day=31"));
    expect(bad.status).toBe(400);
    expect(bad.headers.get("Cache-Control")).toBe("no-store");
    expect(await bad.json()).toEqual({ ok: false, error: { code: "invalid_day", message: "Day must be between 1 and 30" } });

    m.findUnique.mockResolvedValueOnce(null);
    const missing = await handleDailyContent(req("/api/daily-content?day=2"));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    expect(await missing.json()).toEqual({ ok: false, error: { code: "not_found", message: "No content found for this day" } });

    m.findUnique.mockRejectedValueOnce(new Error("Can't reach database server at 127.0.0.1:5432"));
    const down = await handleDailyContent(req("/api/daily-content?day=2"));
    expect(down.status).toBe(503);
    expect(down.headers.get("Cache-Control")).toBe("no-store");
    const text = await down.text();
    expect(text).not.toMatch(LEAK);
    expect(JSON.parse(text)).toEqual({ ok: false, error: { code: "unavailable", message: "Daily content is temporarily unavailable" } });
  });
});
