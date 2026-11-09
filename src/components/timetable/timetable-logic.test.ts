import { describe, expect, it } from "vitest";
import type { TimetableDay } from "@/lib/ramadan-timetable";
import {
  coarse,
  ddmmyyyyToISO,
  decadeDays,
  decadeIndex,
  defaultDecade,
  formatClock,
  formatRange,
  formatRowDate,
  isRamadanNow,
  rowState,
} from "./timetable-logic";

// 1 Ramadan = 9 Feb 2027 (a 30-day month ending 10 Mar 2027).
function month(): TimetableDay[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2027, 1, 9 + i));
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return { day: i + 1, gregorianDate: `${dd}-${mm}-${d.getUTCFullYear()}`, weekday: "Tue", sehri: "05:00", iftar: "17:55", fajr: "05:10", maghrib: "17:55" };
  });
}
const days = month();

describe("row state", () => {
  it("marks days before today past, today today, after upcoming", () => {
    expect(rowState(days[2], "2027-02-12")).toBe("past");
    expect(rowState(days[3], "2027-02-12")).toBe("today");
    expect(rowState(days[4], "2027-02-12")).toBe("upcoming");
  });
  it("treats everything as upcoming before Ramadan and past after it", () => {
    expect(days.every((d) => rowState(d, "2026-11-03") === "upcoming")).toBe(true);
    expect(days.every((d) => rowState(d, "2027-03-11") === "past")).toBe(true);
  });
});

describe("decades", () => {
  it("splits 1-10, 11-20, 21-30", () => {
    expect([1, 10, 11, 20, 21, 30].map(decadeIndex)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(decadeDays(days, 1).map((d) => d.day)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });
  it("defaults to the decade containing today during Ramadan", () => {
    expect(defaultDecade(days, "2027-02-09")).toBe(0);
    expect(defaultDecade(days, "2027-02-18")).toBe(0);
    expect(defaultDecade(days, "2027-02-19")).toBe(1);
    expect(defaultDecade(days, "2027-03-01")).toBe(2);
    expect(defaultDecade(days, "2027-03-10")).toBe(2);
  });
  it("defaults to the first decade outside Ramadan or without data", () => {
    expect(defaultDecade(days, "2026-11-03")).toBe(0);
    expect(defaultDecade(days, "2027-03-11")).toBe(0);
    expect(defaultDecade([], "2027-02-20")).toBe(0);
  });
  it("knows whether it is Ramadan now", () => {
    expect(isRamadanNow(days, "2027-02-25")).toBe(true);
    expect(isRamadanNow(days, "2027-02-08")).toBe(false);
  });
});

describe("formatting", () => {
  it("converts DD-MM-YYYY to ISO", () => expect(ddmmyyyyToISO("09-02-2027")).toBe("2027-02-09"));
  it("formats the range in Bengali digits", () => {
    expect(formatRange({ start: "2027-02-09", end: "2027-03-10" }, "bn")).toBe("৯ ফেব্রুয়ারি – ১০ মার্চ ২০২৭");
    expect(formatRange({ start: "2027-02-09", end: "2027-03-10" }, "en")).toBe("9 February – 10 March 2027");
  });
  it("shows the year on both ends when the month crosses a year", () => {
    expect(formatRange({ start: "2030-12-28", end: "2031-01-26" }, "en")).toBe("28 December 2030 – 26 January 2031");
  });
  it("converts times to 12-hour with locale digits", () => {
    expect(formatClock("17:55", "bn")).toBe("সন্ধ্যা ৫:৫৫");
    expect(formatClock("04:50", "en")).toBe("4:50 AM");
    expect(formatClock("12:05", "en")).toBe("12:05 PM");
    expect(formatClock("00:30", "en")).toBe("12:30 AM");
    expect(formatClock("00:30", "bn")).toBe("রাত ১২:৩০");
    expect(formatClock("17:55", "en", "24h")).toBe("17:55");
    expect(formatClock("04:50", "bn", "24h")).toBe("০৪:৫০");
  });
  it("formats a row date", () => expect(formatRowDate(days[0], "মঙ্গল", "bn")).toBe("মঙ্গল · ৯ ফেব্রু"));
});

describe("coarse", () => {
  it("rounds coordinates to 2 decimals", () => {
    expect(coarse(23.810331)).toBe("23.81");
    expect(coarse(90.412518)).toBe("90.41");
    expect(coarse(-0.1278)).toBe("-0.13");
  });
});
