// The device clock is pinned to Dhaka so device wall-clock time and the cached timings' zone agree.
process.env.TZ = "Asia/Dhaka";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_NIGHT_SCRIPT,
  FALLBACK_NIGHT_END_MIN,
  FALLBACK_NIGHT_START_MIN,
  KNOWN_TIMINGS_EVENT,
  KNOWN_TIMINGS_KEY,
  KNOWN_TIMINGS_MAX_AGE_DAYS,
  autoNightAt,
  isAutoNight,
  isFallbackNight,
  parseKnownTimings,
  readKnownTimings,
  rememberTimings,
  type KnownTimings,
} from "./auto-night";
import { getPrayerPhase, timingsFromPrayerTimes, zonedTime } from "./prayer-phase";

const TZ = "Asia/Dhaka";
const PT = { fajr: "05:15", sunrise: "06:30", dhuhr: "12:10", asr: "15:30", maghrib: "17:55", isha: "19:10", sehri: "05:05" };
const known: KnownTimings = { date: "2027-02-20", timezone: TZ, prayerTimes: PT, source: "geo" };
const at = (hhmm: string, date = "2027-02-20") => zonedTime(date, hhmm, TZ)!;

describe("isFallbackNight (device local time)", () => {
  it("is Night from 18:00 until 05:30", () => {
    for (const t of ["18:00", "23:59", "00:00", "05:29"]) expect(isFallbackNight(at(t))).toBe(true);
  });
  it("is Light from 05:30 until 18:00", () => {
    for (const t of ["05:30", "12:00", "17:59"]) expect(isFallbackNight(at(t))).toBe(false);
  });
  it("embedded literals match the exported constants", () => {
    expect(FALLBACK_NIGHT_START_MIN).toBe(1080);
    expect(FALLBACK_NIGHT_END_MIN).toBe(330);
    expect(KNOWN_TIMINGS_MAX_AGE_DAYS).toBe(7);
  });
});

describe("isAutoNight with known timings", () => {
  it("is Night from Maghrib to Fajr", () => {
    expect(isAutoNight(at("17:54"), known, TZ)).toBe(false);
    expect(isAutoNight(at("17:55"), known, TZ)).toBe(true);
    expect(isAutoNight(at("23:30"), known, TZ)).toBe(true);
    expect(isAutoNight(at("03:00"), known, TZ)).toBe(true);
    expect(isAutoNight(at("05:14"), known, TZ)).toBe(true);
    expect(isAutoNight(at("05:15"), known, TZ)).toBe(false);
    expect(isAutoNight(at("12:00"), known, TZ)).toBe(false);
  });

  it("agrees with getPrayerPhase(...).isNight across the whole day", () => {
    const t = timingsFromPrayerTimes(PT, known.date, TZ, PT.fajr)!;
    for (let m = 0; m < 24 * 60; m += 1) {
      const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const now = at(hhmm);
      expect(isAutoNight(now, known, TZ), hhmm).toBe(getPrayerPhase(now, t).isNight);
    }
  });

  it("applies timings up to a week old to today", () => {
    expect(isAutoNight(at("17:56", "2027-02-27"), known, TZ)).toBe(true);
    expect(isAutoNight(at("17:56", "2027-02-28"), known, TZ)).toBe(false); // 8 days: fallback (before 18:00)
  });

  it("falls back for future-dated, out-of-order, other-timezone or missing timings", () => {
    const n = at("17:56");
    expect(isAutoNight(at("17:56", "2027-02-19"), known, TZ)).toBe(false);
    expect(isAutoNight(n, { ...known, prayerTimes: { ...PT, fajr: "22:48", maghrib: "11:18" } }, TZ)).toBe(false);
    expect(isAutoNight(n, { ...known, timezone: "UTC" }, TZ)).toBe(false);
    expect(autoNightAt(n.getTime(), undefined, known)).toBe(false); // device zone unknown
    expect(isAutoNight(n, null, TZ)).toBe(false);
    expect(autoNightAt(n.getTime(), TZ, { ...known, prayerTimes: { ...PT, maghrib: "soon" } })).toBe(false);
    expect(autoNightAt(n.getTime(), TZ, "garbage")).toBe(false);
    expect(isAutoNight(at("21:00"), null, TZ)).toBe(true);
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

describe("AUTO_NIGHT_SCRIPT (pre-hydration) runs the same decision", () => {
  function run(theme: string | null, cached: unknown, now: Date) {
    const classes = new Set(["light"]);
    const meta = { content: "#F4F7F6", setAttribute: (_: string, v: string) => (meta.content = v) };
    const html = {
      classList: { remove: (c: string) => classes.delete(c), add: (c: string) => classes.add(c) },
      style: { colorScheme: "light" },
    };
    const storage: Record<string, string | null> = {
      theme,
      [KNOWN_TIMINGS_KEY]: cached === null ? null : typeof cached === "string" ? cached : JSON.stringify(cached),
    };
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

  it("does nothing unless the preference is auto", () => {
    expect(run("light", null, at("22:00")).dark).toBe(false);
    expect(run(null, null, at("22:00")).dark).toBe(false);
  });

  it("switches to Night with the matching theme-color", () => {
    expect(run("auto", null, at("22:00"))).toEqual({ dark: true, meta: "#0B1A17", scheme: "dark" });
    expect(run("auto", "{corrupt", at("12:00")).dark).toBe(false);
  });

  it("agrees with isAutoNight for fresh, stale, out-of-order, other-zone and missing caches", () => {
    const cases: unknown[] = [
      known,
      null,
      { ...known, date: "2027-02-10" },
      { ...known, prayerTimes: { ...PT, fajr: "22:48", maghrib: "11:18" } },
      { ...known, timezone: "UTC" },
      { ...known, prayerTimes: { ...PT, maghrib: "19:30", fajr: "04:00" } },
    ];
    const times = ["00:00", "03:59", "04:00", "05:14", "05:15", "05:29", "05:30", "12:00", "17:54", "17:55", "17:59", "18:00", "19:29", "19:30", "23:59"];
    for (const c of cases) {
      for (const t of times) {
        const now = at(t);
        const expected = isAutoNight(now, parseKnownTimings(c), TZ);
        expect(run("auto", c, now).dark, `${JSON.stringify(c)} @ ${t}`).toBe(expected);
      }
    }
  });
});
