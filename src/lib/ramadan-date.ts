/**
 * Ramadan Date Intelligence Service
 *
 * Uses AlAdhan Hijri Calendar API to determine:
 * - Whether today is Ramadan, pre-Ramadan, or post-Ramadan
 * - The current Ramadan day (1-30) if during Ramadan
 * - Days until Ramadan starts (if pre-Ramadan)
 * - Ramadan start/end Gregorian dates for the current Hijri year
 */

const ALADHAN_BASE = "https://api.aladhan.com/v1";

// ── Types ─────────────────────────────────────────────
export type RamadanPhase = "pre-ramadan" | "ramadan" | "post-ramadan";

export interface RamadanStatus {
    phase: RamadanPhase;
    /** Current Ramadan day (1-30), null if not Ramadan */
    currentDay: number | null;
    /** Days until Ramadan starts, null if already started or passed */
    daysUntil: number | null;
    /** Ramadan start date (Gregorian) DD-MM-YYYY */
    ramadanStartGregorian: string | null;
    /** Ramadan end date (Gregorian) DD-MM-YYYY */
    ramadanEndGregorian: string | null;
    /** Current Hijri date info */
    hijriMonth: number;
    hijriMonthName: string;
    hijriDay: string;
    hijriYear: string;
    /** Total days of Ramadan (29 or 30) */
    ramadanTotalDays: number | null;
}

// ── Cache ─────────────────────────────────────────────
const cache = new Map<string, { data: RamadanStatus; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── AlAdhan API response types ────────────────────────
interface HijriCalendarDay {
    gregorian: {
        date: string; // DD-MM-YYYY
        day: string;
        month: { number: number; en: string };
        year: string;
    };
    hijri: {
        date: string;
        day: string;
        month: { number: number; en: string; ar: string };
        year: string;
    };
}

interface GToHResponse {
    code: number;
    data: {
        hijri: {
            date: string;
            day: string;
            month: { number: number; en: string; ar: string };
            year: string;
        };
        gregorian: {
            date: string;
            day: string;
            month: { number: number; en: string };
            year: string;
        };
    };
}

interface HijriCalendarResponse {
    code: number;
    data: HijriCalendarDay[];
}

// ── Core function ─────────────────────────────────────
/**
 * Get the current Ramadan status for a given timezone.
 * Uses AlAdhan API to convert today's date to Hijri, then determines phase.
 */
export async function getRamadanStatus(
    timezone: string = "Asia/Dhaka"
): Promise<RamadanStatus> {
    const cacheKey = `ramadan-${timezone}-${todayKey(timezone)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    try {
        // Step 1: Get today's Hijri date
        const today = getTodayDate(timezone);
        const hijriRes = await fetch(
            `${ALADHAN_BASE}/gToH/${today}`,
            { next: { revalidate: 86400 } }
        );

        if (!hijriRes.ok) {
            throw new Error(`AlAdhan gToH error: ${hijriRes.status}`);
        }

        const hijriJson: GToHResponse = await hijriRes.json();
        if (hijriJson.code !== 200) {
            throw new Error(`AlAdhan gToH returned code ${hijriJson.code}`);
        }

        const { hijri } = hijriJson.data;
        const hijriMonth = hijri.month.number;
        const hijriDay = parseInt(hijri.day, 10);
        const hijriYear = hijri.year;

        let status: RamadanStatus;

        if (hijriMonth === 9) {
            // We're IN Ramadan
            const ramadanDates = await getRamadanGregorianDates(hijriYear);
            status = {
                phase: "ramadan",
                currentDay: hijriDay,
                daysUntil: null,
                ramadanStartGregorian: ramadanDates.start,
                ramadanEndGregorian: ramadanDates.end,
                hijriMonth,
                hijriMonthName: hijri.month.en,
                hijriDay: hijri.day,
                hijriYear,
                ramadanTotalDays: ramadanDates.totalDays,
            };
        } else if (
            hijriMonth < 9 ||
            (hijriMonth === 8 && hijriDay <= 30)
        ) {
            // Pre-Ramadan: calculate days until Ramadan 1
            const daysUntil = await calculateDaysUntilRamadan(
                hijriMonth,
                hijriDay,
                hijriYear,
                timezone
            );
            const ramadanDates = await getRamadanGregorianDates(hijriYear);
            status = {
                phase: "pre-ramadan",
                currentDay: null,
                daysUntil,
                ramadanStartGregorian: ramadanDates.start,
                ramadanEndGregorian: ramadanDates.end,
                hijriMonth,
                hijriMonthName: hijri.month.en,
                hijriDay: hijri.day,
                hijriYear,
                ramadanTotalDays: ramadanDates.totalDays,
            };
        } else {
            // Post-Ramadan (month 10-12)
            status = {
                phase: "post-ramadan",
                currentDay: null,
                daysUntil: null,
                ramadanStartGregorian: null,
                ramadanEndGregorian: null,
                hijriMonth,
                hijriMonthName: hijri.month.en,
                hijriDay: hijri.day,
                hijriYear,
                ramadanTotalDays: null,
            };
        }

        cache.set(cacheKey, { data: status, expiresAt: Date.now() + CACHE_TTL_MS });
        return status;
    } catch (error) {
        console.error("Ramadan status fetch error:", error);
        // Fallback: return a sensible default based on approximate dates
        return getFallbackStatus();
    }
}

// ── Get Ramadan start/end Gregorian dates ─────────────
async function getRamadanGregorianDates(
    hijriYear: string
): Promise<{ start: string; end: string; totalDays: number }> {
    try {
        // Get Ramadan calendar for this Hijri year
        const res = await fetch(
            `${ALADHAN_BASE}/hToGCalendar/9/${hijriYear}`,
            { next: { revalidate: 604800 } } // 7 days
        );

        if (!res.ok) {
            throw new Error(`Hijri calendar error: ${res.status}`);
        }

        const json: HijriCalendarResponse = await res.json();
        if (json.code !== 200 || !json.data.length) {
            throw new Error("Invalid Hijri calendar response");
        }

        const days = json.data;
        const firstDay = days[0];
        const lastDay = days[days.length - 1];

        return {
            start: firstDay.gregorian.date,
            end: lastDay.gregorian.date,
            totalDays: days.length,
        };
    } catch {
        return { start: null as unknown as string, end: null as unknown as string, totalDays: 30 };
    }
}

// ── Calculate days until Ramadan ──────────────────────
async function calculateDaysUntilRamadan(
    currentHijriMonth: number,
    currentHijriDay: number,
    hijriYear: string,
    timezone: string
): Promise<number> {
    try {
        // Get the Gregorian date of Ramadan 1
        const ramadanDates = await getRamadanGregorianDates(hijriYear);
        if (!ramadanDates.start) return 0;

        // Parse DD-MM-YYYY
        const [dd, mm, yyyy] = ramadanDates.start.split("-").map(Number);
        const ramadanStart = new Date(yyyy, mm - 1, dd);

        const today = new Date();
        const todayStr = today.toLocaleDateString("en-CA", { timeZone: timezone });
        const [y, m, d] = todayStr.split("-").map(Number);
        const todayDate = new Date(y, m - 1, d);

        const diffMs = ramadanStart.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return Math.max(0, diffDays);
    } catch {
        // Rough estimate based on Hijri months
        const monthsLeft = 9 - currentHijriMonth - 1;
        const daysInCurrentMonth = 30 - currentHijriDay;
        return monthsLeft * 29.5 + daysInCurrentMonth;
    }
}

// ── Helpers ───────────────────────────────────────────
function getTodayDate(timezone: string): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
    // en-GB → DD/MM/YYYY, AlAdhan expects DD-MM-YYYY
    return formatter.format(now).replace(/\//g, "-");
}

function todayKey(timezone: string): string {
    const now = new Date();
    return now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
}

function getFallbackStatus(): RamadanStatus {
    // Approximate Ramadan 1446 dates (2025): Feb 28 – Mar 30
    const now = new Date();
    const year = now.getFullYear();

    // Very rough approximation for 2025
    const approxStart = new Date(year, 1, 28); // Feb 28
    const approxEnd = new Date(year, 2, 30); // Mar 30

    if (now < approxStart) {
        const diffDays = Math.ceil(
            (approxStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
            phase: "pre-ramadan",
            currentDay: null,
            daysUntil: diffDays,
            ramadanStartGregorian: "28-02-2025",
            ramadanEndGregorian: "30-03-2025",
            hijriMonth: 8,
            hijriMonthName: "Sha'ban",
            hijriDay: "?",
            hijriYear: "1446",
            ramadanTotalDays: 30,
        };
    } else if (now <= approxEnd) {
        const diffDays = Math.ceil(
            (now.getTime() - approxStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        return {
            phase: "ramadan",
            currentDay: Math.min(diffDays, 30),
            daysUntil: null,
            ramadanStartGregorian: "28-02-2025",
            ramadanEndGregorian: "30-03-2025",
            hijriMonth: 9,
            hijriMonthName: "Ramadan",
            hijriDay: String(Math.min(diffDays, 30)),
            hijriYear: "1446",
            ramadanTotalDays: 30,
        };
    }

    return {
        phase: "post-ramadan",
        currentDay: null,
        daysUntil: null,
        ramadanStartGregorian: null,
        ramadanEndGregorian: null,
        hijriMonth: 10,
        hijriMonthName: "Shawwal",
        hijriDay: "?",
        hijriYear: "1446",
        ramadanTotalDays: null,
    };
}
