/**
 * Prayer phase engine (pure).
 *
 * Maps "now" + a day's prayer instants to the UI phase (sehri / day / iftar /
 * night), the next upcoming event, a countdown and segment progress. Also holds
 * the sadaqah-card visibility rule and Bengali/English countdown formatting.
 *
 * No React, no clock access: `now` is always a parameter.
 */

import type { PrayerTimes } from "@/types/database";

// ── Types ─────────────────────────────────────────────

export type PrayerPhase = "sehri" | "day" | "iftar" | "night";
export type NextKey = "sehri" | "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface PhaseTimings {
    fajr: Date;
    sunrise?: Date;
    dhuhr: Date;
    asr: Date;
    maghrib: Date;
    isha: Date;
    /** Sehri end (Imsak). Defaults to fajr when absent. */
    sehriEnd?: Date;
    /** Tomorrow's fajr, used for the countdown after isha. */
    nextFajr?: Date;
    /** Start of the local day (00:00). Defaults to local midnight of fajr's day. */
    dayStart?: Date;
    /** End of the local day (24:00). Defaults to dayStart + 24h. */
    dayEnd?: Date;
}

export interface PrayerPhaseResult {
    phase: PrayerPhase;
    next: { key: NextKey; at: Date };
    remainingMs: number;
    /** Elapsed fraction (0..1) of the current phase segment. */
    progress: number;
    /** True for the sehri and night phases (drives auto Night mode). */
    isNight: boolean;
}

export interface SadaqahOptions {
    ramadanDay?: number | null;
    isEid?: boolean;
    dismissedAt?: Date | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Iftar phase = last hour before maghrib. */
export const IFTAR_WINDOW_MS = HOUR;
/** No sadaqah prompt within this distance of a prayer time. */
export const PRAYER_QUIET_MS = 15 * MINUTE;
/** A dismissed sadaqah card stays hidden this long. */
export const SADAQAH_DISMISS_MS = DAY;
/** Sadaqah is shown from this Ramadan day (last ten nights). */
export const LAST_TEN_FROM_DAY = 21;

// ── Engine ────────────────────────────────────────────

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function progressOf(now: number, start: number, end: number): number {
    return end > start ? clamp01((now - start) / (end - start)) : 1;
}

function dayBounds(t: PhaseTimings): { start: Date; end: Date } {
    let start = t.dayStart;
    if (!start) {
        start = new Date(t.fajr);
        start.setHours(0, 0, 0, 0);
    }
    const end = t.dayEnd ?? new Date(start.getTime() + DAY);
    return { start, end };
}

export function getPrayerPhase(now: Date, t: PhaseTimings): PrayerPhaseResult {
    const n = now.getTime();
    const { start, end } = dayBounds(t);
    const fajr = t.fajr.getTime();
    const maghrib = t.maghrib.getTime();
    const iftarStart = maghrib - IFTAR_WINDOW_MS;

    const make = (
        phase: PrayerPhase,
        key: NextKey,
        at: Date,
        segStart: number,
        segEnd: number,
    ): PrayerPhaseResult => ({
        phase,
        next: { key, at },
        remainingMs: Math.max(0, at.getTime() - n),
        progress: progressOf(n, segStart, segEnd),
        isNight: phase === "sehri" || phase === "night",
    });

    if (n < fajr) {
        // Sehri: from day start to fajr. Before the sehri end, count down to it.
        const sehriEnd = t.sehriEnd && t.sehriEnd.getTime() < fajr ? t.sehriEnd : null;
        if (sehriEnd && n < sehriEnd.getTime()) {
            return make("sehri", "sehri", sehriEnd, start.getTime(), fajr);
        }
        return make("sehri", "fajr", t.fajr, start.getTime(), fajr);
    }

    if (n < iftarStart) {
        const upcoming: [NextKey, Date][] = [
            ["dhuhr", t.dhuhr],
            ["asr", t.asr],
        ];
        const hit = upcoming.find(([, d]) => n < d.getTime());
        const [key, at] = hit ?? (["maghrib", t.maghrib] as [NextKey, Date]);
        return make("day", key, at, fajr, iftarStart);
    }

    if (n < maghrib) {
        return make("iftar", "maghrib", t.maghrib, iftarStart, maghrib);
    }

    // Night: maghrib → end of day.
    if (n < t.isha.getTime()) {
        return make("night", "isha", t.isha, maghrib, end.getTime());
    }
    const tomorrowFajr = t.nextFajr ?? new Date(fajr + DAY);
    return make("night", "fajr", tomorrowFajr, maghrib, end.getTime());
}

// ── Sadaqah rule ──────────────────────────────────────

/**
 * Sadaqah card visibility.
 * Show only after maghrib (night phase), from Ramadan day 21, or on Eid.
 * Never during sehri, within ±15 min of any of the five prayers, or within
 * 24h of a dismissal.
 */
export function shouldShowSadaqah(
    now: Date,
    t: PhaseTimings,
    opts: SadaqahOptions = {},
): boolean {
    const n = now.getTime();
    const { ramadanDay, isEid, dismissedAt } = opts;

    if (dismissedAt && n - dismissedAt.getTime() < SADAQAH_DISMISS_MS) return false;

    const { phase } = getPrayerPhase(now, t);
    if (phase === "sehri") return false;

    const prayers = [t.fajr, t.dhuhr, t.asr, t.maghrib, t.isha];
    if (prayers.some((p) => Math.abs(n - p.getTime()) <= PRAYER_QUIET_MS)) return false;

    if (isEid) return true;
    if (typeof ramadanDay === "number" && ramadanDay >= LAST_TEN_FROM_DAY) return true;
    return phase === "night" && n >= t.maghrib.getTime();
}

// ── Adapter: "HH:mm" strings → Dates ──────────────────

function tzOffsetMs(utcMs: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const v = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
    return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The instant at which `dateISO` (YYYY-MM-DD) shows `hhmm` on a wall clock in `timeZone`. */
export function zonedTime(dateISO: string, hhmm: string, timeZone: string): Date | null {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
    const h = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
    if (!d || !h) return null;
    const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1], +h[2]);
    let guess = wall - tzOffsetMs(wall, timeZone);
    guess = wall - tzOffsetMs(guess, timeZone);
    return new Date(guess);
}

function addDaysISO(dateISO: string, days: number): string {
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Convert the app's string timings (see PrayerTimes) for a calendar day into
 * PhaseTimings. `nextFajrHHmm` is tomorrow's fajr if known. Returns null when
 * any required time fails to parse.
 */
export function timingsFromPrayerTimes(
    pt: Pick<PrayerTimes, "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"> &
        Partial<Pick<PrayerTimes, "sunrise" | "sehri">>,
    dateISO: string,
    timeZone: string,
    nextFajrHHmm?: string,
): PhaseTimings | null {
    const at = (s: string) => zonedTime(dateISO, s, timeZone);
    const fajr = at(pt.fajr);
    const dhuhr = at(pt.dhuhr);
    const asr = at(pt.asr);
    const maghrib = at(pt.maghrib);
    const isha = at(pt.isha);
    const dayStart = at("00:00");
    const dayEnd = zonedTime(addDaysISO(dateISO, 1), "00:00", timeZone);
    if (!fajr || !dhuhr || !asr || !maghrib || !isha || !dayStart || !dayEnd) return null;
    return {
        fajr,
        dhuhr,
        asr,
        maghrib,
        isha,
        sunrise: (pt.sunrise && at(pt.sunrise)) || undefined,
        sehriEnd: (pt.sehri && at(pt.sehri)) || undefined,
        nextFajr: nextFajrHHmm
            ? (zonedTime(addDaysISO(dateISO, 1), nextFajrHHmm, timeZone) ?? undefined)
            : undefined,
        dayStart,
        dayEnd,
    };
}

// ── Bengali digits and countdown formatting ───────────

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Replace ASCII digits 0-9 with Bengali digits. Accepts numbers too. */
export function toBengaliDigits(s: string | number): string {
    return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

function hm(ms: number): { h: number; m: number } {
    const total = Math.ceil(Math.max(0, ms) / MINUTE);
    return { h: Math.floor(total / 60), m: total % 60 };
}

/** "আর ২ ঘণ্টা ১৪ মিনিট" / "আর ৪৮ মিনিট" / "এখন". Sub-minute remainders round up to 1 minute. */
export function formatRemainingBn(ms: number): string {
    if (!(ms > 0)) return "এখন";
    const { h, m } = hm(ms);
    const parts = [h > 0 ? `${toBengaliDigits(h)} ঘণ্টা` : "", m > 0 ? `${toBengaliDigits(m)} মিনিট` : ""];
    return `আর ${parts.filter(Boolean).join(" ")}`;
}

/** "2h 14m left" / "48m left" / "Now". */
export function formatRemainingEn(ms: number): string {
    if (!(ms > 0)) return "Now";
    const { h, m } = hm(ms);
    const parts = [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : ""];
    return `${parts.filter(Boolean).join(" ")} left`;
}
