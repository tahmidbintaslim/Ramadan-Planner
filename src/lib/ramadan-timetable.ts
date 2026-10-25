/**
 * Ramadan Timetable Service
 *
 * Fetches full Ramadan month Sehri & Iftar schedule from AlAdhan API.
 * Uses the Gregorian calendar endpoint (/v1/calendar/{year}/{month})
 * and filters for Hijri month 9 (Ramadan) days — this is more reliable
 * than the /hijriCalendar endpoint which can return 400 errors.
 *
 * Ramadan spans 2 Gregorian months, so we fetch both and merge.
 */

const ALADHAN_BASE = "https://api.aladhan.com/v1";

import {
    getHijriOffsetForTimezone,
} from "./hijri-offsets";

// ── Types ─────────────────────────────────────────────
export interface TimetableDay {
    /** Ramadan day (1-30) */
    day: number;
    /** Gregorian date DD-MM-YYYY */
    gregorianDate: string;
    /** Gregorian day name (Mon, Tue, etc.) */
    weekday: string;
    /** Sehri end time (Imsak) HH:MM */
    sehri: string;
    /** Iftar time (Maghrib) HH:MM */
    iftar: string;
    /** Fajr time HH:MM */
    fajr: string;
    /** Maghrib time HH:MM */
    maghrib: string;
}

export interface RamadanTimetable {
    days: TimetableDay[];
    location: string;
    timezone: string;
    hijriYear: string;
    method: string;
}

// ── Cache ─────────────────────────────────────────────
const cache = new Map<string, { data: RamadanTimetable; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── AlAdhan calendar response types ───────────────────
interface AlAdhanCalendarTimings {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    Imsak: string;
    [key: string]: string;
}

interface AlAdhanCalendarDay {
    timings: AlAdhanCalendarTimings;
    date: {
        readable: string;
        timestamp: string;
        hijri: {
            date: string;
            day: string;
            month: { number: number; en: string; ar: string };
            year: string;
            weekday: { en: string; ar: string };
        };
        gregorian: {
            date: string; // DD-MM-YYYY
            day: string;
            month: { number: number; en: string };
            year: string;
            weekday: { en: string };
        };
    };
}

interface AlAdhanCalendarResponse {
    code: number;
    data: AlAdhanCalendarDay[];
}

// ── Strip timezone suffixes like " (+07)" or " (ICT)" from time strings ──
function cleanTime(t: string): string {
    return t.replace(/\s*\(.*\)$/, "");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hijri month (1-12) of `date` in `timezone`, by the Umm al-Qura calendar. */
function hijriMonth(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
        timeZone: timezone,
        month: "numeric",
    }).formatToParts(date);
    return parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
}

/**
 * Determine which Gregorian months to scan for Ramadan.
 *
 * Targets the current Ramadan, or the next one when today is outside it:
 * outside Ramadan the months around today hold no Hijri month 9, so the
 * timetable used to fail for most of the year. Walks forward from today to
 * the first day of Hijri month 9 (Umm al-Qura, computed locally) and
 * returns that Gregorian month with the one before and after. Ramadan
 * spans at most two Gregorian months, and the extra month on each side
 * absorbs the day or two by which AlAdhan's calendar method and the
 * per-country Hijri offset can differ from Umm al-Qura.
 */
export function getGregorianMonthsToScan(
    timezone: string,
    now: Date = new Date(),
): Array<{ year: number; month: number }> {
    let anchor = now;
    for (let i = 0; i < 400 && hijriMonth(anchor, timezone) !== 9; i++) {
        anchor = new Date(anchor.getTime() + DAY_MS);
    }

    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
    });
    const parts = formatter.format(anchor).split("-"); // YYYY-MM
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    const months: Array<{ year: number; month: number }> = [];
    for (let i = -1; i <= 1; i++) {
        let m = month + i;
        let y = year;
        if (m > 12) { m -= 12; y += 1; }
        if (m < 1) { m += 12; y -= 1; }
        months.push({ year: y, month: m });
    }
    return months;
}

/**
 * Fetch a single Gregorian month's calendar from AlAdhan
 */
async function fetchGregorianMonth(
    year: number,
    month: number,
    latitude: number,
    longitude: number,
    timezone: string,
    offset: number
): Promise<AlAdhanCalendarDay[]> {
    const url = `${ALADHAN_BASE}/calendar/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=1&school=1&timezonestring=${encodeURIComponent(timezone)}&calendarMethod=MATHEMATICAL&adjustment=${offset}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
        console.error(`AlAdhan calendar error for ${year}/${month}: ${res.status}`);
        return [];
    }

    const json: AlAdhanCalendarResponse = await res.json();
    if (json.code !== 200 || !json.data?.length) {
        return [];
    }

    return json.data;
}

// ── Core function ─────────────────────────────────────
/**
 * Fetch the full Ramadan timetable for a location.
 *
 * Uses the Gregorian calendar endpoint and filters for Hijri month 9.
 * Fetches multiple Gregorian months since Ramadan spans ~2 months.
 */
export async function fetchRamadanTimetable(
    latitude: number,
    longitude: number,
    _hijriYear: string,
    timezone: string,
    locationLabel: string,
): Promise<RamadanTimetable> {
    const cacheKey = `timetable-${latitude.toFixed(2)},${longitude.toFixed(2)},${timezone}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    // Fetch multiple Gregorian months and filter for Ramadan (Hijri month 9)
    const monthsToScan = getGregorianMonthsToScan(timezone);

    const allDays: AlAdhanCalendarDay[] = [];
    const offset = getHijriOffsetForTimezone(timezone);
    for (const { year, month } of monthsToScan) {
        const monthData = await fetchGregorianMonth(year, month, latitude, longitude, timezone, offset);
        allDays.push(...monthData);
    }

    // Filter for Ramadan days only (Hijri month 9)
    const ramadanDays = allDays.filter(
        (d) => d.date.hijri.month.number === 9
    );

    if (ramadanDays.length === 0) {
        throw new Error("No Ramadan days found in the current period. Ramadan may not have started yet.");
    }

    // Sort by Hijri day to ensure correct order
    ramadanDays.sort((a, b) => parseInt(a.date.hijri.day, 10) - parseInt(b.date.hijri.day, 10));

    // Deduplicate (in case of overlapping month fetches)
    const seen = new Set<number>();
    const uniqueDays = ramadanDays.filter((d) => {
        const hijriDay = parseInt(d.date.hijri.day, 10);
        if (seen.has(hijriDay)) return false;
        seen.add(hijriDay);
        return true;
    });

    const hijriYear = uniqueDays[0]?.date.hijri.year || _hijriYear;

    const days: TimetableDay[] = uniqueDays.map((d) => ({
        day: parseInt(d.date.hijri.day, 10),
        gregorianDate: d.date.gregorian.date,
        weekday: d.date.gregorian.weekday.en.slice(0, 3),
        sehri: cleanTime(d.timings.Imsak),
        iftar: cleanTime(d.timings.Maghrib),
        fajr: cleanTime(d.timings.Fajr),
        maghrib: cleanTime(d.timings.Maghrib),
    }));

    const timetable: RamadanTimetable = {
        days,
        location: locationLabel,
        timezone,
        hijriYear,
        method: "University of Islamic Sciences, Karachi (Hanafi)",
    };

    cache.set(cacheKey, { data: timetable, expiresAt: Date.now() + CACHE_TTL_MS });
    return timetable;
}
