import { afterEach, describe, expect, it, vi } from "vitest";
import { ALADHAN_METHOD_PARAMS, ALADHAN_TUNE, cleanAlAdhanTime, fastTimesFromAlAdhan } from "./fast-times";
import { fetchPrayerTimes } from "./prayer-times";
import { fetchRamadanTimetable } from "./ramadan-timetable";

// The Home (fetchPrayerTimes) and the timetable (fetchRamadanTimetable) must show the same Sehri and Iftar for the
// same day. One fake AlAdhan answers both, with a different Imsak per day, so a mismatch in the request (method,
// school, zone) or in parsing would show.
const imsakFor = (day: number) => `04:${String(59 - (day % 10)).padStart(2, "0")} (+06)`;
const maghribFor = (day: number) => `17:${String(40 + (day % 10)).padStart(2, "0")} (+06)`;
const hijri = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });

function aladhanDay(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const p = Object.fromEntries(hijri.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    timings: { Imsak: imsakFor(d), Fajr: "05:10 (+06)", Sunrise: "06:25 (+06)", Dhuhr: "12:10 (+06)", Asr: "16:20 (+06)", Maghrib: maghribFor(d), Isha: "19:10 (+06)" },
    date: {
      hijri: { day: p.day, month: { number: Number(p.month), en: "Ramaḍān", ar: "رَمَضان" }, year: p.year },
      gregorian: { date: `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`, weekday: { en: "Saturday" } },
    },
  };
}

describe("fast times: one function for the Home and the timetable", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("drops AlAdhan's zone suffix and maps Imsak to Sehri, Maghrib to Iftar", () => {
    expect(cleanAlAdhanTime("04:57 (+06)")).toBe("04:57");
    expect(fastTimesFromAlAdhan({ Imsak: "04:57 (+06)", Fajr: "05:07 (+06)", Maghrib: "17:58 (+06)" })).toEqual({
      sehri: "04:57",
      iftar: "17:58",
      fajr: "05:07",
      maghrib: "17:58",
    });
  });

  it("the Home's Sehri/Iftar equals the timetable row for 20 Feb 2027 in Dhaka", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-20T06:00:00Z"));
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        const cal = /\/calendar\/(\d+)\/(\d+)\?/.exec(url);
        if (cal) {
          const [y, m] = [Number(cal[1]), Number(cal[2])];
          const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
          return new Response(JSON.stringify({ code: 200, data: Array.from({ length: days }, (_, i) => aladhanDay(y, m, i + 1)) }));
        }
        const one = /\/timings\/(\d+)-(\d+)-(\d+)\?/.exec(url);
        if (one) return new Response(JSON.stringify({ code: 200, data: aladhanDay(Number(one[3]), Number(one[2]), Number(one[1])) }));
        return new Response("not found", { status: 404 });
      }),
    );

    const home = await fetchPrayerTimes(23.81, 90.41, "20-02-2027", "Asia/Dhaka", "Dhaka");
    const table = await fetchRamadanTimetable(23.81, 90.41, "", "Asia/Dhaka", "Dhaka");
    const row = table.days.find((d) => d.gregorianDate === "20-02-2027");

    expect(home.source).toBe("aladhan");
    expect(row).toBeDefined();
    expect({ sehri: home.prayerTimes.sehri, iftar: home.prayerTimes.iftar }).toEqual({ sehri: row!.sehri, iftar: row!.iftar });
    expect(home.prayerTimes.sehri).toBe("04:59");
    // Both requests use the same method and school.
    for (const u of urls.filter((u) => /aladhan/.test(u))) expect(u).toContain("method=1&school=1&tune=7,0,0,0,0,2,0,0,0");
  });
});

describe("IFB tune", () => {
  it("moves Imsak to Fajr - 3 and Maghrib to sunset + 2, and leaves Fajr alone", () => {
    expect(ALADHAN_TUNE.split(",").map(Number)).toEqual([7, 0, 0, 0, 0, 2, 0, 0, 0]);
    expect(ALADHAN_METHOD_PARAMS).toBe("method=1&school=1&tune=7,0,0,0,0,2,0,0,0");
  });
});
