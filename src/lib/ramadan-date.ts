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

import {
    getConfiguredHijriOffset,
    getCountryCodeForTimezone,
    getHijriOffsetForCoordinates,
    getHijriOffsetForTimezone,
} from "./hijri-offsets";

const HIJRI_MONTHS_EN: Record<number, string> = {
    1: "Muharram",
    2: "Safar",
    3: "Rabi' al-Awwal",
    4: "Rabi' al-Thani",
    5: "Jumada al-Awwal",
    6: "Jumada al-Thani",
    7: "Rajab",
    8: "Sha'ban",
    9: "Ramadan",
    10: "Shawwal",
    11: "Dhu al-Qi'dah",
    12: "Dhu al-Hijjah",
};

function normalizeHijriMonthName(name: string | undefined, monthNumber: number): string {
    const fallback = HIJRI_MONTHS_EN[monthNumber] ?? "Ramadan";
    if (!name || typeof name !== "string") return fallback;

    const cleaned = name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’ʻ`]/g, "'")
        .trim();

    return cleaned || fallback;
}

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
    timezone: string = "Asia/Dhaka",
    countryCode?: string,
    coordinates?: { latitude: number; longitude: number },
): Promise<RamadanStatus> {
    const resolvedCountry = (countryCode ?? getCountryCodeForTimezone(timezone))?.toUpperCase();
    const configuredOffset = getConfiguredHijriOffset();
    const adj =
        coordinates
            ? getHijriOffsetForCoordinates(coordinates.latitude, coordinates.longitude)
            : getHijriOffsetForTimezone(timezone);
    const coordsKey = coordinates
        ? `${coordinates.latitude.toFixed(2)},${coordinates.longitude.toFixed(2)}`
        : "NA";
    const cacheKey = `ramadan-${timezone}-${resolvedCountry ?? "NA"}-coords:${coordsKey}-adj:${adj}-cfg:${configuredOffset ?? "none"}-${todayKey(timezone)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    try {
        // Only use the global "official" endpoint for BD (or unknown country).
        // Non-BD locations should prefer location-aware AlAdhan+adjustment logic.
        const useOfficialForCountry =
            configuredOffset === null && (!resolvedCountry || resolvedCountry === "BD");
        if (useOfficialForCountry) {
            try {
                const base = (process.env.RAMADAN_OFFICIAL_API || "https://ramadan.munafio.com").replace(/\/$/, "");
                const dateParam = getTodayDate(timezone); // DD-MM-YYYY in target timezone
                const url = `${base}/api/check?date=${encodeURIComponent(dateParam)}`;
                const r = await fetch(url, { next: { revalidate: 1800 } });
                if (r.ok) {
                    const j = await r.json();
                    if (j?.status === "success" && j?.data) {
                        const d = j.data;
                        const isRamadan = !!d.isRamadan;
                        const hijri = d.hijriDate;
                        if (isRamadan && hijri) {
                            const dayNo = Number(hijri.day?.number ?? parseInt((hijri.date || "1-09-1447").split("-")[0], 10));
                            const totalDays = d.totalDays ?? null;
                            const status: RamadanStatus = {
                                phase: "ramadan",
                                currentDay: isNaN(dayNo) ? null : Math.min(Math.max(dayNo, 1), totalDays ?? 30),
                                daysUntil: null,
                                ramadanStartGregorian: null,
                                ramadanEndGregorian: null,
                                hijriMonth: hijri.month?.number ?? 9,
                                hijriMonthName: normalizeHijriMonthName(
                                    hijri.month?.title,
                                    hijri.month?.number ?? 9,
                                ),
                                hijriDay: String(hijri.day?.number ?? hijri.date?.split("-")[0] ?? "?"),
                                hijriYear: hijri.year ?? "",
                                ramadanTotalDays: totalDays,
                            };
                            cache.set(cacheKey, { data: status, expiresAt: Date.now() + CACHE_TTL_MS });
                            return status;
                        } else {
                            // Not Ramadan according to official API — continue to AlAdhan flow below for richer data.
                            const status: RamadanStatus = {
                                phase: "pre-ramadan",
                                currentDay: null,
                                daysUntil: null,
                                ramadanStartGregorian: null,
                                ramadanEndGregorian: null,
                                hijriMonth: hijri?.month?.number ?? 8,
                                hijriMonthName: normalizeHijriMonthName(
                                    hijri?.month?.title,
                                    hijri?.month?.number ?? 8,
                                ),
                                hijriDay: hijri?.day?.number ?? "?",
                                hijriYear: hijri?.year ?? "",
                                ramadanTotalDays: null,
                            };
                            cache.set(cacheKey, { data: status, expiresAt: Date.now() + CACHE_TTL_MS });
                        }
                    }
                }
            } catch (e) {
                console.warn("Munafio Ramadan API check failed, falling back to AlAdhan:", e);
            }
        }
        // Step 1: Get today's Hijri date
        const today = getTodayDate(timezone);
        const gToHUrl = `${ALADHAN_BASE}/gToH/${today}?calendarMethod=MATHEMATICAL&adjustment=${adj}`;
        const hijriRes = await fetch(
            gToHUrl,
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
            const ramadanDates = await getRamadanGregorianDates(
                hijriYear,
                adj,
            );
            status = {
                phase: "ramadan",
                currentDay: hijriDay,
                daysUntil: null,
                ramadanStartGregorian: ramadanDates.start,
                ramadanEndGregorian: ramadanDates.end,
                hijriMonth,
                hijriMonthName: normalizeHijriMonthName(hijri.month.en, hijriMonth),
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
                timezone,
                adj,
            );
            const ramadanDates = await getRamadanGregorianDates(
                hijriYear,
                adj,
            );
            status = {
                phase: "pre-ramadan",
                currentDay: null,
                daysUntil,
                ramadanStartGregorian: ramadanDates.start,
                ramadanEndGregorian: ramadanDates.end,
                hijriMonth,
                hijriMonthName: normalizeHijriMonthName(hijri.month.en, hijriMonth),
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
                hijriMonthName: normalizeHijriMonthName(hijri.month.en, hijriMonth),
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
    hijriYear: string,
    adjustment: number,
): Promise<{ start: string; end: string; totalDays: number }> {
    try {
        const hToGUrl = `${ALADHAN_BASE}/hToGCalendar/9/${hijriYear}?calendarMethod=MATHEMATICAL&adjustment=${adjustment}`;
        // Try hToGCalendar first
        const res = await fetch(
            hToGUrl,
            { next: { revalidate: 604800 } } // 7 days
        );

        if (res.ok) {
            const json: HijriCalendarResponse = await res.json();
            if (json.code === 200 && json.data.length) {
                const days = json.data;
                return {
                    start: days[0].gregorian.date,
                    end: days[days.length - 1].gregorian.date,
                    totalDays: days.length,
                };
            }
        }

        // Fallback: scan Gregorian calendar for the current year
        // and find Ramadan days by checking Hijri month 9
        return await getRamadanDatesFromGregorian(adjustment);
    } catch {
        return await getRamadanDatesFromGregorian(adjustment);
    }
}

/**
 * Fallback: scan Gregorian months to find Ramadan start/end dates.
 * Uses the more reliable /v1/calendar endpoint.
 */
async function getRamadanDatesFromGregorian(adjustment: number): Promise<{
    start: string;
    end: string;
    totalDays: number;
}> {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-indexed

        // Scan current month ± 1 to find Ramadan days
        const monthsToCheck = [month - 1, month, month + 1].filter(
            (m) => m >= 1 && m <= 12
        );

        const allRamadanDays: Array<{ gregDate: string }> = [];

        for (const m of monthsToCheck) {
            const res = await fetch(
                `${ALADHAN_BASE}/calendar/${year}/${m}?latitude=23.8103&longitude=90.4125&method=1&calendarMethod=MATHEMATICAL&adjustment=${adjustment}`,
                { next: { revalidate: 604800 } }
            );
            if (!res.ok) continue;

            const json = await res.json();
            if (json.code !== 200 || !json.data) continue;

            for (const day of json.data) {
                if (day.date?.hijri?.month?.number === 9) {
                    allRamadanDays.push({
                        gregDate: day.date.gregorian.date,
                    });
                }
            }
        }

        if (allRamadanDays.length > 0) {
            return {
                start: allRamadanDays[0].gregDate,
                end: allRamadanDays[allRamadanDays.length - 1].gregDate,
                totalDays: allRamadanDays.length,
            };
        }
    } catch {
        // fall through
    }

    return {
        start: null as unknown as string,
        end: null as unknown as string,
        totalDays: 30,
    };
}

// ── Calculate days until Ramadan ──────────────────────
async function calculateDaysUntilRamadan(
    currentHijriMonth: number,
    currentHijriDay: number,
    hijriYear: string,
    timezone: string,
    adjustment: number,
): Promise<number> {
    try {
        // Get the Gregorian date of Ramadan 1
        const ramadanDates = await getRamadanGregorianDates(hijriYear, adjustment);
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
    // Approximate Ramadan 1447 dates (2026): Feb 18 – Mar 19
    const now = new Date();
    const year = now.getFullYear();

    // Approximate Ramadan start/end per year
    const ramadanDates: Record<number, { start: [number, number]; end: [number, number]; hijriYear: string }> = {
        2025: { start: [1, 28], end: [2, 30], hijriYear: "1446" }, // Feb 28 – Mar 30
        2026: { start: [1, 18], end: [2, 19], hijriYear: "1447" }, // Feb 18 – Mar 19
        2027: { start: [1, 8], end: [2, 9], hijriYear: "1448" },   // Feb 8 – Mar 9
    };

    const yearData = ramadanDates[year] || ramadanDates[2026];
    const approxStart = new Date(year, yearData.start[0], yearData.start[1]);
    const approxEnd = new Date(year, yearData.end[0], yearData.end[1]);
    const startStr = `${String(yearData.start[1]).padStart(2, "0")}-${String(yearData.start[0] + 1).padStart(2, "0")}-${year}`;
    const endStr = `${String(yearData.end[1]).padStart(2, "0")}-${String(yearData.end[0] + 1).padStart(2, "0")}-${year}`;

    if (now < approxStart) {
        const diffDays = Math.ceil(
            (approxStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
            phase: "pre-ramadan",
            currentDay: null,
            daysUntil: diffDays,
            ramadanStartGregorian: startStr,
            ramadanEndGregorian: endStr,
            hijriMonth: 8,
            hijriMonthName: "Sha'ban",
            hijriDay: "?",
            hijriYear: yearData.hijriYear,
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
            ramadanStartGregorian: startStr,
            ramadanEndGregorian: endStr,
            hijriMonth: 9,
            hijriMonthName: "Ramadan",
            hijriDay: String(Math.min(diffDays, 30)),
            hijriYear: yearData.hijriYear,
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
        hijriYear: yearData.hijriYear,
        ramadanTotalDays: null,
    };
}
