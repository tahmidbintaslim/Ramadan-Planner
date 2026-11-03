import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_NIGHT_SCRIPT,
  KNOWN_TIMINGS_EVENT,
  KNOWN_TIMINGS_KEY,
  isAutoNight,
  isFallbackNight,
  parseKnownTimings,
  readKnownTimings,
  rememberTimings,
  type KnownTimings,
} from "./auto-night";
import { zonedTime } from "./prayer-phase";

const TZ = "Asia/Dhaka";
const PT = { fajr: "05:15", sunrise: "06:30", dhuhr: "12:10", asr: "15:30", maghrib: "17:55", isha: "19:10", sehri: "05:05" };
const known: KnownTimings = { date: "2027-02-20", timezone: TZ, prayerTimes: PT, source: "geo" };
const at = (hhmm: string, date = "2027-02-20") => zonedTime(date, hhmm, TZ)!;

describe("isFallbackNight (device local time)", () => {
  const local = (h: number, m: number) => new Date(2027, 1, 20, h, m);
  it("is Night from 18:00 until 05:30", () => {
    expect(isFallbackNight(local(18, 0))).toBe(true);
    expect(isFallbackNight(local(23, 59))).toBe(true);
    expect(isFallbackNight(local(0, 0))).toBe(true);
    expect(isFallbackNight(local(5, 29))).toBe(true);
  });
  it("is Light from 05:30 until 18:00", () => {
    expect(isFallbackNight(local(5, 30))).toBe(false);
    expect(isFallbackNight(local(12, 0))).toBe(false);
    expect(isFallbackNight(local(17, 59))).toBe(false);
  });
});

describe("isAutoNight with known timings", () => {
  it("follows the phase engine: Night from Maghrib to Fajr", () => {
    expect(isAutoNight(at("17:54"), known)).toBe(false); // iftar phase
    expect(isAutoNight(at("17:55"), known)).toBe(true); // maghrib
    expect(isAutoNight(at("23:30"), known)).toBe(true);
    expect(isAutoNight(at("03:00"), known)).toBe(true); // sehri
    expect(isAutoNight(at("05:14"), known)).toBe(true);
    expect(isAutoNight(at("05:15"), known)).toBe(false); // fajr: day begins
    expect(isAutoNight(at("12:00"), known)).toBe(false);
  });

  it("applies recent (up to a week old) timings to today", () => {
    expect(isAutoNight(at("19:00", "2027-02-25"), known)).toBe(true);
    expect(isAutoNight(at("10:00", "2027-02-25"), known)).toBe(false);
  });

  it("uses the fallback for stale, future-dated or broken timings", () => {
    // 17:56 Dhaka is after maghrib, but the fallback (device time) decides. Compare against it directly.
    const stale = at("17:56", "2027-03-10");
    expect(isAutoNight(stale, known)).toBe(isFallbackNight(stale));
    const future = at("17:56", "2027-02-10");
    expect(isAutoNight(future, known)).toBe(isFallbackNight(future));
    const shifted = { ...known, prayerTimes: { ...PT, fajr: "22:48", maghrib: "11:18", isha: "12:35" } };
    expect(isAutoNight(at("12:00"), shifted)).toBe(isFallbackNight(at("12:00")));
    const broken = { ...known, timezone: "Not/AZone" };
    expect(isAutoNight(at("12:00"), broken)).toBe(isFallbackNight(at("12:00")));
  });

  it("uses the fallback without timings", () => {
    const d = new Date(2027, 1, 20, 21, 0);
    expect(isAutoNight(d, null)).toBe(true);
    expect(isAutoNight(new Date(2027, 1, 20, 9, 0), null)).toBe(false);
  });
});

describe("parseKnownTimings", () => {
  it("accepts a valid entry and defaults the source to tz", () => {
    expect(parseKnownTimings({ ...known, source: undefined })?.source).toBe("tz");
    expect(parseKnownTimings(known)).toEqual(known);
  });
  it("rejects malformed values", () => {
    expect(parseKnownTimings(null)).toBeNull();
    expect(parseKnownTimings("x")).toBeNull();
    expect(parseKnownTimings({ ...known, date: "20-02-2027" })).toBeNull();
    expect(parseKnownTimings({ ...known, timezone: "" })).toBeNull();
    expect(parseKnownTimings({ ...known, prayerTimes: { ...PT, maghrib: "soon" } })).toBeNull();
    expect(parseKnownTimings({ ...known, prayerTimes: undefined })).toBeNull();
  });
});

describe("storage helpers", () => {
  let store: Record<string, string>;
  const dispatch = vi.fn();
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
    vi.stubGlobal("window", { dispatchEvent: dispatch });
    dispatch.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips and notifies", () => {
    rememberTimings({ prayerTimes: PT, timezone: TZ }, "tz", at("10:00"));
    expect(readKnownTimings()).toEqual({ ...known, source: "tz" });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: KNOWN_TIMINGS_EVENT }));
  });

  it("keeps a same-day geo entry over a tz one, but a new day replaces it", () => {
    rememberTimings({ prayerTimes: PT, timezone: TZ }, "geo", at("10:00"));
    rememberTimings({ prayerTimes: { ...PT, maghrib: "18:30" }, timezone: TZ }, "tz", at("11:00"));
    expect(readKnownTimings()?.prayerTimes.maghrib).toBe("17:55");
    rememberTimings({ prayerTimes: { ...PT, maghrib: "17:56" }, timezone: TZ }, "tz", at("10:00", "2027-02-21"));
    expect(readKnownTimings()).toMatchObject({ date: "2027-02-21", source: "tz" });
  });

  it("returns null for corrupt storage and never throws", () => {
    store[KNOWN_TIMINGS_KEY] = "{not json";
    expect(readKnownTimings()).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readKnownTimings()).toBeNull();
    expect(() => rememberTimings({ prayerTimes: PT, timezone: TZ }, "geo")).not.toThrow();
  });
});

describe("AUTO_NIGHT_SCRIPT (pre-hydration)", () => {
  function run(theme: string | null, cached: KnownTimings | null, now: Date) {
    const classes = new Set(["light"]);
    const meta = { content: "#F3F8F6", setAttribute: (_: string, v: string) => (meta.content = v) };
    const html = {
      classList: { remove: (c: string) => classes.delete(c), add: (c: string) => classes.add(c) },
      style: { colorScheme: "light" },
    };
    const storage: Record<string, string | null> = { theme, [KNOWN_TIMINGS_KEY]: cached ? JSON.stringify(cached) : null };
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      new Function("localStorage", "document", AUTO_NIGHT_SCRIPT)(
        { getItem: (k: string) => storage[k] ?? null },
        { documentElement: html, querySelector: () => meta },
      );
    } finally {
      vi.useRealTimers();
    }
    return { dark: classes.has("dark") && !classes.has("light"), meta: meta.content, scheme: html.style.colorScheme };
  }
  const local = (h: number, m: number) => new Date(2027, 1, 20, h, m);

  it("does nothing unless the preference is auto", () => {
    expect(run("light", null, local(22, 0)).dark).toBe(false);
    expect(run(null, null, local(22, 0)).dark).toBe(false);
  });
  it("uses the 18:00–05:30 fallback without cached timings", () => {
    expect(run("auto", null, local(22, 0))).toEqual({ dark: true, meta: "#0B1F24", scheme: "dark" });
    expect(run("auto", null, local(12, 0)).dark).toBe(false);
  });
  it("uses cached Maghrib/Fajr as device wall-clock times", () => {
    const cached = { ...known, prayerTimes: { ...PT, maghrib: "19:30", fajr: "04:00" } };
    expect(run("auto", cached, local(19, 0)).dark).toBe(false);
    expect(run("auto", cached, local(19, 30)).dark).toBe(true);
    expect(run("auto", cached, local(4, 30)).dark).toBe(false);
  });
});
