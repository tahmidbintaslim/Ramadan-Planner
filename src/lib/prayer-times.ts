import type { PrayerTimes, TimingData } from "@/types/database";
import { fetchIslamicApiPrayerTimes } from "./islamic-api";
import { getHijriAdjustmentParams, getHijriOffsetForLocation, getCountryCodeForTimezone } from "./hijri-offsets";

// AlAdhan API response types
interface AlAdhanTiming {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Sunset: string;
    Maghrib: string;
    Isha: string;
    Imsak: string;
    Midnight: string;
    Firstthird: string;
    Lastthird: string;
}

interface AlAdhanHijriMonth {
    number: number;
    en: string;
    ar: string;
}

interface AlAdhanDate {
    hijri: {
        date: string;
        day: string;
        month: AlAdhanHijriMonth;
        year: string;
    };
    gregorian: {
        date: string;
    };
}

interface AlAdhanResponse {
    code: number;
    status: string;
    data: {
        timings: AlAdhanTiming;
        date: AlAdhanDate;
    };
}

// Hijri month names in Bengali
const HIJRI_MONTHS_BN: Record<number, string> = {
    1: "মুহাররম",
    2: "সফর",
    3: "রবিউল আউয়াল",
    4: "রবিউস সানি",
    5: "জমাদিউল আউয়াল",
    6: "জমাদিউস সানি",
    7: "রজব",
    8: "শাবান",
    9: "রমযান",
    10: "শাওয়াল",
    11: "জিলকদ",
    12: "জিলহজ",
};

// ── Cache ──────────────────────────────────────────────
// In-memory cache with 24-hour TTL keyed by "lat,lng,date"
const cache = new Map<string, { data: TimingData; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(lat: number, lng: number, date: string): string {
    // Round to 2 decimal places for sensible cache hits
    return `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
}

function getFromCache(key: string): TimingData | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: TimingData): void {
    // Evict old entries if cache grows too large (limit 500)
    if (cache.size > 500) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Fetch from AlAdhan API ────────────────────────────
// method=1 → University of Islamic Sciences, Karachi (commonly used in BD)
// school=1 → Hanafi (standard for Bangladesh)
const ALADHAN_BASE = "https://api.aladhan.com/v1/timings";

export async function fetchPrayerTimes(
    latitude: number,
    longitude: number,
    date: string, // DD-MM-YYYY
    timezone: string,
    locationLabel: string
): Promise<TimingData> {
    const key = cacheKey(latitude, longitude, date);
    const cached = getFromCache(key);
    if (cached) return cached;

    // Try IslamicAPI (if key present) then fall back to AlAdhan
    let timings: AlAdhanTiming | null = null;
    let dateInfo: AlAdhanDate | null = null;
    try {
        const ia = await fetchIslamicApiPrayerTimes(latitude, longitude, date, timezone);
        // Map IslamicAPI v1 response to our expected shape if possible
        if (ia && ia.data && ia.data.timings) {
            timings = ia.data.timings as unknown as AlAdhanTiming;
            dateInfo = ia.data.date as unknown as AlAdhanDate;
        }
    } catch {
        // ignore and fallback to AlAdhan
    }

    if (!timings || !dateInfo) {
        const country = getCountryCodeForTimezone(timezone) ?? "DEFAULT";
        const offset = getHijriOffsetForLocation(country);
        const adjustmentParams = getHijriAdjustmentParams(offset);
        const url = `${ALADHAN_BASE}/${date}?latitude=${latitude}&longitude=${longitude}&method=1&school=1&timezonestring=${encodeURIComponent(timezone)}${adjustmentParams}`;
        const res = await fetch(url, { next: { revalidate: 86400 } }); // ISR 24h
        if (!res.ok) {
            throw new Error(`AlAdhan API error: ${res.status} ${res.statusText}`);
        }

        const json: AlAdhanResponse = await res.json();
        if (json.code !== 200) {
            throw new Error(`AlAdhan API returned code ${json.code}`);
        }

        timings = json.data.timings;
        dateInfo = json.data.date;
    }

    // Strip " (BST)" etc. timezone suffixes from time strings
    const clean = (t: string) => t.replace(/\s*\(.*\)$/, "");

    const prayerTimes: PrayerTimes = {
        fajr: clean(timings.Fajr),
        sunrise: clean(timings.Sunrise),
        dhuhr: clean(timings.Dhuhr),
        asr: clean(timings.Asr),
        maghrib: clean(timings.Maghrib),
        isha: clean(timings.Isha),
        sehri: clean(timings.Imsak), // Imsak = Sehri end time
        iftar: clean(timings.Maghrib), // Iftar = Maghrib
    };

    const hijriMonth = dateInfo.hijri.month;

    const timingData: TimingData = {
        prayerTimes,
        hijriDate: {
            day: dateInfo.hijri.day,
            month: hijriMonth.en,
            year: dateInfo.hijri.year,
            monthAr: hijriMonth.ar,
            monthBn: HIJRI_MONTHS_BN[hijriMonth.number] ?? hijriMonth.en,
        },
        gregorianDate: dateInfo.gregorian.date,
        timezone,
        location: locationLabel,
    };

    setCache(key, timingData);
    return timingData;
}

// ── Defaults (Dhaka) ──────────────────────────────────
export const DHAKA_DEFAULTS = {
    latitude: 23.8103,
    longitude: 90.4125,
    timezone: "Asia/Dhaka",
    locationLabel: "ঢাকা, বাংলাদেশ",
} as const;

// ── Helper: derive location label from IANA timezone ──
// "Asia/Bangkok" → "Bangkok", "America/New_York" → "New York"
export function locationLabelFromTimezone(timezone: string): string {
    const parts = timezone.split("/");
    const city = parts[parts.length - 1];
    // Replace underscores with spaces: "New_York" → "New York"
    return city.replace(/_/g, " ");
}

// ── Helper: today's date as DD-MM-YYYY ────────────────
export function todayDateString(timezone: string): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
    // en-GB returns DD/MM/YYYY but AlAdhan API expects DD-MM-YYYY
    return formatter.format(now).replace(/\//g, "-");
}

// ── Helper: time until iftar ──────────────────────────
export function minutesUntilIftar(
    iftarTime: string,
    timezone: string
): number | null {
    const now = new Date();
    const [hh, mm] = iftarTime.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    // Build iftar Date in the user's timezone
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
    const iftarDate = new Date(`${todayStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);

    // Approximate: if timezone offset difference matters, this is close enough for a countdown
    const diffMs = iftarDate.getTime() - now.getTime();
    if (diffMs < 0) return null; // Iftar has passed
    return Math.ceil(diffMs / 60000);
}
