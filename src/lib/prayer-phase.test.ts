import { describe, expect, it } from "vitest";
import {
    formatRemainingBn,
    formatRemainingEn,
    getPrayerPhase,
    shouldShowSadaqah,
    timingsFromPrayerTimes,
    toBengaliDigits,
    todayISOInZone,
    zonedTime,
    type PhaseTimings,
} from "./prayer-phase";

const TZ = "Asia/Dhaka"; // UTC+6, no DST
const DATE = "2027-02-20";
const at = (hhmm: string, date = DATE) => zonedTime(date, hhmm, TZ)!;

const t = timingsFromPrayerTimes(
    {
        fajr: "05:15",
        sunrise: "06:30",
        dhuhr: "12:10",
        asr: "15:30",
        maghrib: "17:55",
        isha: "19:10",
        sehri: "05:05",
    },
    DATE,
    TZ,
    "05:14",
) as PhaseTimings;

describe("zonedTime / timingsFromPrayerTimes", () => {
    it("converts Dhaka wall clock to UTC", () => {
        expect(at("05:15").toISOString()).toBe("2027-02-19T23:15:00.000Z");
        expect(at("00:00").toISOString()).toBe("2027-02-19T18:00:00.000Z");
    });

    it("handles a negative-offset zone", () => {
        expect(zonedTime("2027-02-20", "12:00", "America/New_York")!.toISOString()).toBe(
            "2027-02-20T17:00:00.000Z",
        );
    });

    it("builds day bounds and next fajr", () => {
        expect(t.dayStart!.toISOString()).toBe("2027-02-19T18:00:00.000Z");
        expect(t.dayEnd!.toISOString()).toBe("2027-02-20T18:00:00.000Z");
        expect(t.nextFajr!.toISOString()).toBe("2027-02-20T23:14:00.000Z");
        expect(t.sehriEnd!.toISOString()).toBe("2027-02-19T23:05:00.000Z");
    });

    it("returns null for unparsable times and rejects bad dates", () => {
        expect(
            timingsFromPrayerTimes(
                { fajr: "x", dhuhr: "12:00", asr: "15:00", maghrib: "18:00", isha: "19:00" },
                DATE,
                TZ,
                "05:14",
            ),
        ).toBeNull();
        expect(zonedTime("20-02-2027", "05:00", TZ)).toBeNull();
    });
});

describe("getPrayerPhase", () => {
    const cases: {
        name: string;
        now: string;
        phase: string;
        next: string;
        nextAt: string;
        isNight: boolean;
    }[] = [
        { name: "exactly midnight start", now: "00:00", phase: "sehri", next: "sehri", nextAt: "05:05", isNight: true },
        { name: "before sehri end", now: "04:00", phase: "sehri", next: "sehri", nextAt: "05:05", isNight: true },
        { name: "between sehri end and fajr", now: "05:05", phase: "sehri", next: "fajr", nextAt: "05:15", isNight: true },
        { name: "one minute before fajr", now: "05:14", phase: "sehri", next: "fajr", nextAt: "05:15", isNight: true },
        { name: "exactly fajr", now: "05:15", phase: "day", next: "dhuhr", nextAt: "12:10", isNight: false },
        { name: "midday", now: "12:10", phase: "day", next: "asr", nextAt: "15:30", isNight: false },
        { name: "after asr", now: "16:00", phase: "day", next: "maghrib", nextAt: "17:55", isNight: false },
        { name: "one minute before iftar window", now: "16:54", phase: "day", next: "maghrib", nextAt: "17:55", isNight: false },
        { name: "exactly maghrib-60", now: "16:55", phase: "iftar", next: "maghrib", nextAt: "17:55", isNight: false },
        { name: "one minute before maghrib", now: "17:54", phase: "iftar", next: "maghrib", nextAt: "17:55", isNight: false },
        { name: "exactly maghrib", now: "17:55", phase: "night", next: "isha", nextAt: "19:10", isNight: true },
        { name: "exactly isha", now: "19:10", phase: "night", next: "fajr", nextAt: "05:14", isNight: true },
        { name: "late night", now: "23:59", phase: "night", next: "fajr", nextAt: "05:14", isNight: true },
    ];

    it.each(cases)("$name ($now)", (c) => {
        const r = getPrayerPhase(at(c.now), t);
        expect(r.phase).toBe(c.phase);
        expect(r.next.key).toBe(c.next);
        // nextFajr belongs to tomorrow
        const nextDate = c.next === "fajr" && c.phase === "night" ? "2027-02-21" : DATE;
        expect(r.next.at.getTime()).toBe(at(c.nextAt, nextDate).getTime());
        expect(r.isNight).toBe(c.isNight);
        expect(r.remainingMs).toBe(r.next.at.getTime() - at(c.now).getTime());
        expect(r.progress).toBeGreaterThanOrEqual(0);
        expect(r.progress).toBeLessThanOrEqual(1);
    });

    it("computes progress per segment", () => {
        expect(getPrayerPhase(at("00:00"), t).progress).toBe(0);
        // sehri segment 00:00 -> 05:15; at 02:37:30 it is half
        expect(getPrayerPhase(new Date(at("00:00").getTime() + 157.5 * 60_000), t).progress).toBeCloseTo(0.5);
        expect(getPrayerPhase(at("05:15"), t).progress).toBe(0);
        expect(getPrayerPhase(at("16:55"), t).progress).toBe(0);
        expect(getPrayerPhase(at("17:25"), t).progress).toBeCloseTo(0.5);
        expect(getPrayerPhase(at("17:55"), t).progress).toBe(0);
        // night segment 17:55 -> 24:00, 6h05m; clamp past the end
        expect(getPrayerPhase(at("00:00", "2027-02-21"), t).progress).toBe(1);
        expect(getPrayerPhase(at("00:00", "2027-02-21"), t).phase).toBe("night");
    });

    it("works without sehriEnd", () => {
        const bare: PhaseTimings = { ...t, sehriEnd: undefined };
        expect(getPrayerPhase(at("03:00"), bare).next).toEqual({ key: "fajr", at: t.fajr });
        expect(getPrayerPhase(at("21:00"), bare).next.at).toEqual(t.nextFajr);
    });

    it("after isha counts down to tomorrow's sehri end when known", () => {
        const tt = timingsFromPrayerTimes(
            { fajr: "05:15", dhuhr: "12:10", asr: "15:30", maghrib: "17:55", isha: "19:10", sehri: "05:05" },
            DATE,
            TZ,
            "05:14",
            "05:04",
        )!;
        expect(tt.nextSehriEnd!.toISOString()).toBe("2027-02-20T23:04:00.000Z");
        const r = getPrayerPhase(at("21:00"), tt);
        expect(r.phase).toBe("night");
        expect(r.next).toEqual({ key: "sehri", at: tt.nextSehriEnd });
        expect(r.remainingMs).toBe((8 * 60 + 4) * 60_000);
        expect(r.isNight).toBe(true);
        // Before isha the target is still isha; the night progress segment is unchanged.
        expect(getPrayerPhase(at("18:30"), tt).next.key).toBe("isha");
        expect(r.progress).toBeCloseTo(getPrayerPhase(at("21:00"), t).progress);
    });

    it("ignores a next sehri end at or after tomorrow's fajr", () => {
        const late: PhaseTimings = { ...t, nextSehriEnd: t.nextFajr };
        expect(getPrayerPhase(at("21:00"), late).next).toEqual({ key: "fajr", at: t.nextFajr });
        const pt = { fajr: "05:15", dhuhr: "12:10", asr: "15:30", maghrib: "17:55", isha: "19:10" };
        expect(timingsFromPrayerTimes(pt, DATE, TZ, "05:14")!.nextSehriEnd).toBeUndefined();
    });

    it("never returns negative remaining time", () => {
        expect(getPrayerPhase(at("12:00"), t).remainingMs).toBeGreaterThan(0);
    });
});

describe("shouldShowSadaqah", () => {
    const base = { ramadanDay: 10, isEid: false, dismissedAt: null };

    const cases: { name: string; now: string; opts: object; expected: boolean }[] = [
        { name: "midday, early Ramadan", now: "14:00", opts: {}, expected: false },
        { name: "evening before maghrib window, early Ramadan", now: "17:00", opts: {}, expected: false },
        { name: "night, 16 min after maghrib", now: "18:11", opts: {}, expected: true },
        { name: "night, exactly 15 min after maghrib", now: "18:10", opts: {}, expected: false },
        { name: "night, at maghrib", now: "17:55", opts: {}, expected: false },
        { name: "night, 15 min before isha", now: "18:55", opts: {}, expected: false },
        { name: "night, 16 min before isha", now: "18:54", opts: {}, expected: true },
        { name: "late night", now: "22:00", opts: {}, expected: true },
        { name: "last ten, midday", now: "14:00", opts: { ramadanDay: 21 }, expected: true },
        { name: "day 20 midday", now: "14:00", opts: { ramadanDay: 20 }, expected: false },
        { name: "last ten, within 15 min of dhuhr", now: "12:25", opts: { ramadanDay: 25 }, expected: false },
        { name: "last ten, 16 min after dhuhr", now: "12:26", opts: { ramadanDay: 25 }, expected: true },
        { name: "last ten, within 15 min of asr", now: "15:20", opts: { ramadanDay: 25 }, expected: false },
        { name: "last ten, sehri phase", now: "03:00", opts: { ramadanDay: 25 }, expected: false },
        { name: "last ten, 15 min after fajr", now: "05:30", opts: { ramadanDay: 25 }, expected: false },
        { name: "last ten, 16 min after fajr", now: "05:31", opts: { ramadanDay: 25 }, expected: true },
        { name: "eid midday", now: "14:00", opts: { isEid: true }, expected: true },
        { name: "eid sehri phase", now: "03:00", opts: { isEid: true }, expected: false },
        { name: "eid near maghrib", now: "17:50", opts: { isEid: true }, expected: false },
        { name: "null ramadanDay, night", now: "21:00", opts: { ramadanDay: null }, expected: true },
    ];

    it.each(cases)("$name ($now)", (c) => {
        expect(shouldShowSadaqah(at(c.now), t, { ...base, ...c.opts })).toBe(c.expected);
    });

    it("hides for 24h after dismissal, then returns", () => {
        const now = at("21:00");
        const justUnder = new Date(now.getTime() - (24 * 3_600_000 - 1));
        const exactly = new Date(now.getTime() - 24 * 3_600_000);
        expect(shouldShowSadaqah(now, t, { ramadanDay: 10, dismissedAt: justUnder })).toBe(false);
        expect(shouldShowSadaqah(now, t, { ramadanDay: 10, dismissedAt: exactly })).toBe(true);
    });

    it("dismissal beats eid and last-ten", () => {
        const now = at("14:00");
        const dismissed = new Date(now.getTime() - 3_600_000);
        expect(shouldShowSadaqah(now, t, { isEid: true, dismissedAt: dismissed })).toBe(false);
        expect(shouldShowSadaqah(now, t, { ramadanDay: 28, dismissedAt: dismissed })).toBe(false);
    });

    it("works with no options", () => {
        expect(shouldShowSadaqah(at("21:00"), t)).toBe(true);
    });
});

describe("toBengaliDigits", () => {
    it.each([
        ["0123456789", "০১২৩৪৫৬৭৮৯"],
        ["05:02", "০৫:০২"],
        ["Day 21 of 30", "Day ২১ of ৩০"],
        ["", ""],
        ["রমযান", "রমযান"],
    ])("%s -> %s", (input, out) => {
        expect(toBengaliDigits(input)).toBe(out);
    });

    it("accepts numbers", () => {
        expect(toBengaliDigits(2027)).toBe("২০২৭");
    });
});

describe("formatRemaining", () => {
    const m = 60_000;
    const h = 60 * m;

    it.each([
        [2 * h + 14 * m, "আর ২ ঘণ্টা ১৪ মিনিট", "2h 14m left"],
        [48 * m, "আর ৪৮ মিনিট", "48m left"],
        [2 * h, "আর ২ ঘণ্টা", "2h left"],
        [10 * h + 5 * m, "আর ১০ ঘণ্টা ৫ মিনিট", "10h 5m left"],
        [59 * m + 1, "আর ১ ঘণ্টা", "1h left"],
        [30_000, "আর ১ মিনিট", "1m left"],
        [1, "আর ১ মিনিট", "1m left"],
        [0, "এখন", "Now"],
        [-5000, "এখন", "Now"],
        [Number.NaN, "এখন", "Now"],
    ])("%d ms", (ms, bn, en) => {
        expect(formatRemainingBn(ms)).toBe(bn);
        expect(formatRemainingEn(ms)).toBe(en);
    });
});

describe("todayISOInZone", () => {
    it("differs between Dhaka and UTC near midnight", () => {
        const now = new Date("2027-02-20T19:00:00Z"); // 01:00 on the 21st in Dhaka
        expect(todayISOInZone(now, "Asia/Dhaka")).toBe("2027-02-21");
        expect(todayISOInZone(now, "UTC")).toBe("2027-02-20");
    });
});

describe("DST days (Europe/London)", () => {
    const L = "Europe/London";
    const pt = { fajr: "04:30", dhuhr: "12:00", asr: "15:30", maghrib: "18:00", isha: "19:30", sehri: "04:20" };
    const H = 3_600_000;

    it("spring forward 2027-03-28 is a 23h day", () => {
        const d = "2027-03-28";
        const tt = timingsFromPrayerTimes(pt, d, L, "04:25")!;
        expect(tt.dayStart.toISOString()).toBe("2027-03-28T00:00:00.000Z");
        expect(tt.dayEnd.toISOString()).toBe("2027-03-28T23:00:00.000Z");
        expect(tt.dayEnd.getTime() - tt.dayStart.getTime()).toBe(23 * H);
        const z = (h: string) => zonedTime(d, h, L)!;
        expect(getPrayerPhase(z("03:00"), tt).phase).toBe("sehri");
        expect(getPrayerPhase(z("12:00"), tt).phase).toBe("day");
        expect(getPrayerPhase(z("17:30"), tt).phase).toBe("iftar");
        const post = getPrayerPhase(z("20:00"), tt);
        expect(post.phase).toBe("night");
        expect(post.next).toEqual({ key: "fajr", at: zonedTime("2027-03-29", "04:25", L)! });
        expect(post.remainingMs).toBe(post.next.at.getTime() - z("20:00").getTime());
        expect(getPrayerPhase(tt.dayEnd, tt).progress).toBe(1);
    });

    it("fall back 2027-10-31 is a 25h day", () => {
        const d = "2027-10-31";
        const tt = timingsFromPrayerTimes(pt, d, L, "06:10")!;
        expect(tt.dayStart.toISOString()).toBe("2027-10-30T23:00:00.000Z");
        expect(tt.dayEnd.toISOString()).toBe("2027-11-01T00:00:00.000Z");
        expect(tt.dayEnd.getTime() - tt.dayStart.getTime()).toBe(25 * H);
        const z = (h: string) => zonedTime(d, h, L)!;
        expect(getPrayerPhase(z("03:00"), tt).phase).toBe("sehri");
        expect(getPrayerPhase(z("12:00"), tt).phase).toBe("day");
        const post = getPrayerPhase(z("20:00"), tt);
        expect(post.phase).toBe("night");
        expect(post.next.at.toISOString()).toBe("2027-11-01T06:10:00.000Z");
        expect(post.remainingMs).toBe(10 * H + 10 * 60_000);
    });
});
