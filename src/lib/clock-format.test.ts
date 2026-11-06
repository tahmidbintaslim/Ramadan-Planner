import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLOCK_FORMAT_EVENT,
  CLOCK_FORMAT_KEY,
  DEFAULT_CLOCK_FORMAT,
  bnDayPeriod,
  clockParts,
  formatDateTime,
  formatHHMM,
  joinClockParts,
  parseClockFormat,
  readClockFormat,
  wallClock,
  writeClockFormat,
} from "./clock-format";
import { formatPrayerClock } from "@/components/prayer/use-prayer-phase";

describe("formatDateTime", () => {
  const at = new Date("2027-02-12T11:55:00Z"); // 17:55 in Dhaka
  it("uses the clock format for the time, never seconds", () => {
    expect(formatDateTime(at, "en", "12h", "Asia/Dhaka")).toBe("12 Feb 2027 · 5:55 PM");
    expect(formatDateTime(at, "en", "24h", "Asia/Dhaka")).toBe("12 Feb 2027 · 17:55");
    expect(formatDateTime(at, "bn", "12h", "Asia/Dhaka")).toMatch(/· সন্ধ্যা ৫:৫৫$/);
  });
});

describe("bnDayPeriod (Bangladeshi day periods for bn 12-hour times)", () => {
  it.each([
    [0, 5, "রাত"], [3, 59, "রাত"], [4, 0, "ভোর"], [4, 57, "ভোর"], [5, 59, "ভোর"], [6, 0, "সকাল"], [11, 29, "সকাল"],
    [11, 30, "দুপুর"], [11, 42, "দুপুর"], [12, 14, "দুপুর"], [14, 59, "দুপুর"], [15, 0, "বিকাল"], [16, 18, "বিকাল"], [16, 59, "বিকাল"],
    // Maghrib/Iftar in late November, Bangladesh's earliest sunset, is ~17:10: it must read সন্ধ্যা.
    [17, 0, "সন্ধ্যা"], [17, 17, "সন্ধ্যা"], [17, 58, "সন্ধ্যা"], [18, 59, "সন্ধ্যা"], [19, 0, "রাত"], [19, 12, "রাত"], [23, 59, "রাত"],
  ] as const)("%i:%i -> %s", (h, m, word) => {
    expect(bnDayPeriod(h, m)).toBe(word);
  });

  it("every bn 12-hour time carries a period; English keeps AM/PM", () => {
    expect(formatHHMM("04:57", "bn")).toBe("ভোর ৪:৫৭");
    expect(formatHHMM("17:58", "bn")).toBe("সন্ধ্যা ৫:৫৮");
    expect(formatHHMM("16:18", "bn")).toBe("বিকাল ৪:১৮");
    expect(formatHHMM("04:57", "en")).toBe("4:57 AM");
    expect(formatHHMM("17:58", "en")).toBe("5:58 PM");
    expect(formatHHMM("04:57", "bn", "24h")).toBe("০৪:৫৭");
  });
});

describe("formatHHMM", () => {
  it.each([
    // en 12h: always AM/PM
    ["00:05", "en", "12h", "12:05 AM"],
    ["04:12", "en", "12h", "4:12 AM"],
    ["12:00", "en", "12h", "12:00 PM"],
    ["17:55", "en", "12h", "5:55 PM"],
    ["23:59", "en", "12h", "11:59 PM"],
    // bn 12h: a day-period word only from 00:00 to 03:59, where a bare time is ambiguous
    ["00:05", "bn", "12h", "রাত ১২:০৫"],
    ["03:59", "bn", "12h", "রাত ৩:৫৯"],
    ["04:00", "bn", "12h", "ভোর ৪:০০"],
    ["04:12", "bn", "12h", "ভোর ৪:১২"],
    ["17:55", "bn", "12h", "সন্ধ্যা ৫:৫৫"],
    // 24h: zero-padded, no period, in either language
    ["04:12", "en", "24h", "04:12"],
    ["17:55", "en", "24h", "17:55"],
    ["00:05", "bn", "24h", "০০:০৫"],
    ["17:55", "bn", "24h", "১৭:৫৫"],
  ] as const)("%s %s %s -> %s", (hhmm, locale, format, out) => {
    expect(formatHHMM(hhmm, locale, format)).toBe(out);
  });

  it("defaults to 12-hour and tolerates suffixes and bad input", () => {
    expect(DEFAULT_CLOCK_FORMAT).toBe("12h");
    expect(formatHHMM("05:02 (+06)", "en")).toBe("5:02 AM");
    expect(formatHHMM("5:02", "bn")).toBe("ভোর ৫:০২");
    expect(formatHHMM("--:--", "bn")).toBe("--:--");
    expect(formatHHMM("24:10", "en", "24h")).toBe("00:10");
  });
});

describe("clockParts / joinClockParts", () => {
  it("puts the period after the time in English and before it in Bengali", () => {
    expect(clockParts(17, 5, "en")).toEqual({ time: "5:05", period: "PM", periodFirst: false });
    expect(clockParts(2, 30, "bn")).toEqual({ time: "২:৩০", period: "রাত", periodFirst: true });
    expect(clockParts(16, 5, "bn")).toEqual({ time: "৪:০৫", period: "বিকাল", periodFirst: true });
    expect(clockParts(17, 5, "bn", "24h")).toEqual({ time: "১৭:০৫", period: null, periodFirst: true });
    expect(joinClockParts(clockParts(2, 30, "bn"))).toBe("রাত ২:৩০");
    expect(joinClockParts(clockParts(2, 30, "en", "24h"))).toBe("02:30");
  });
});

describe("wallClock / formatPrayerClock", () => {
  const at = new Date("2027-02-20T21:10:00Z"); // 03:10 in Dhaka, 21:10 in London
  it("reads the wall clock of the zone", () => {
    expect(wallClock(at, "Asia/Dhaka")).toEqual({ hour: 3, minute: 10 });
    expect(wallClock(at, "Europe/London")).toEqual({ hour: 21, minute: 10 });
  });
  it("follows the format", () => {
    expect(formatPrayerClock(at, "Asia/Dhaka", "bn")).toBe("রাত ৩:১০");
    expect(formatPrayerClock(at, "Asia/Dhaka", "en")).toBe("3:10 AM");
    expect(formatPrayerClock(at, "Europe/London", "en", "24h")).toBe("21:10");
    expect(formatPrayerClock(at, "Europe/London", "bn", "24h")).toBe("২১:১০");
  });
});

describe("stored preference", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("parses only known values", () => {
    expect(parseClockFormat("24h")).toBe("24h");
    expect(parseClockFormat("12h")).toBe("12h");
    expect(parseClockFormat("bogus")).toBe("12h");
    expect(parseClockFormat(null)).toBe("12h");
  });

  it("round-trips through localStorage and announces the change", () => {
    const seen = vi.fn();
    window.addEventListener(CLOCK_FORMAT_EVENT, seen);
    expect(readClockFormat()).toBe("12h");
    writeClockFormat("24h");
    expect(localStorage.getItem(CLOCK_FORMAT_KEY)).toBe("24h");
    expect(readClockFormat()).toBe("24h");
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("keeps the choice in memory when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    writeClockFormat("24h");
    expect(readClockFormat()).toBe("24h");
    writeClockFormat("12h");
    expect(readClockFormat()).toBe("12h");
  });
});
