import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRamadanTimetable, getGregorianMonthsToScan } from "./ramadan-timetable";

const at = (iso: string) => new Date(`${iso}T06:00:00Z`);

describe("getGregorianMonthsToScan", () => {
  it("targets the next Ramadan outside Ramadan", () => {
    // 1 Ramadan 1448 is 8 Feb 2027 (Umm al-Qura).
    expect(getGregorianMonthsToScan("Asia/Dhaka", at("2026-10-25"))).toEqual([
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
      { year: 2027, month: 3 },
    ]);
  });

  it("targets the current Ramadan during Ramadan", () => {
    // Ramadan 1447: 18 Feb to 19 Mar 2026.
    expect(getGregorianMonthsToScan("Asia/Dhaka", at("2026-03-01"))).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
    ]);
  });

  it("moves to the next year the day after Ramadan ends", () => {
    // 20 Mar 2026 is 1 Shawwal 1447.
    expect(getGregorianMonthsToScan("Asia/Bangkok", at("2026-03-20"))).toEqual([
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
      { year: 2027, month: 3 },
    ]);
  });
});

/* A stand-in for AlAdhan's /v1/calendar/{year}/{month}: every day of the
   month, with its Umm al-Qura Hijri date. */
function calendarMonth(year: number, month: number) {
  const hijri = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1, i + 1, 12));
    const parts = Object.fromEntries(hijri.formatToParts(date).map((p) => [p.type, p.value]));
    const dd = String(i + 1).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return {
      timings: { Imsak: "04:50 (+06)", Fajr: "05:00 (+06)", Maghrib: "17:55 (+06)" },
      date: {
        hijri: {
          day: parts.day,
          month: { number: Number(parts.month) },
          year: parts.year,
        },
        gregorian: { date: `${dd}-${mm}-${year}`, weekday: { en: "Monday" } },
      },
    };
  });
}

describe("fetchRamadanTimetable", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns next year's Ramadan instead of failing outside Ramadan", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("2026-10-25"));
    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const [, y, m] = /\/calendar\/(\d+)\/(\d+)\?/.exec(url) ?? [];
        requested.push(`${y}-${m}`);
        return new Response(JSON.stringify({ code: 200, data: calendarMonth(+y, +m) }));
      }),
    );

    const timetable = await fetchRamadanTimetable(23.81, 90.41, "", "Asia/Dhaka", "Dhaka");

    expect(requested).toEqual(["2027-1", "2027-2", "2027-3"]);
    expect(timetable.hijriYear).toBe("1448");
    expect(timetable.days[0]).toMatchObject({ day: 1, gregorianDate: "08-02-2027", sehri: "04:50" });
    expect(timetable.days.map((d) => d.day)).toEqual(
      Array.from({ length: timetable.days.length }, (_, i) => i + 1),
    );
    expect(timetable.days.length).toBeGreaterThanOrEqual(29);
  });
});
