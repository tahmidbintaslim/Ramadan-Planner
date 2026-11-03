/**
 * Auto Night mode: when the theme preference is "auto", Night (the `.dark` class) applies from Maghrib to Fajr.
 *
 * The decision uses the prayer phase engine (`getPrayerPhase(...).isNight`) with the user's last known timings
 * (cached in localStorage by whichever screen fetched them). Without timings it falls back to a fixed local
 * window, 18:00 to 05:30. Pure apart from the small storage helpers at the bottom, which never throw.
 */

import type { PrayerTimes } from "@/types/database";
import { getPrayerPhase, timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";

/** Fallback window (minutes after local midnight): Night from 18:00 until 05:30. */
export const FALLBACK_NIGHT_START_MIN = 18 * 60;
export const FALLBACK_NIGHT_END_MIN = 5 * 60 + 30;
/** Cached timings older than this many days are ignored (they drift, and the user may have moved). */
export const KNOWN_TIMINGS_MAX_AGE_DAYS = 7;
export const KNOWN_TIMINGS_KEY = "rp_known_timings";
/** Fired on window after `rememberTimings`, so the shell can re-evaluate straight away. */
export const KNOWN_TIMINGS_EVENT = "rp:known-timings";

export type KnownPrayerTimes = Pick<PrayerTimes, "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"> &
  Partial<Pick<PrayerTimes, "sunrise" | "sehri">>;

export interface KnownTimings {
  /** Calendar date (YYYY-MM-DD, in `timezone`) the times belong to. */
  date: string;
  timezone: string;
  prayerTimes: KnownPrayerTimes;
  /** "geo" = fetched with the device location (preferred), "tz" = timezone defaults. */
  source: "geo" | "tz";
}

/** Fixed-window fallback, in the device's local time. */
export function isFallbackNight(now: Date): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= FALLBACK_NIGHT_START_MIN || m < FALLBACK_NIGHT_END_MIN;
}

function daysBetweenISO(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

/**
 * Whether Auto mode should show Night at `now`. Recent timings (up to a week old) are applied to today's date:
 * the times drift by about a minute a day, which is still far closer than the fixed fallback.
 */
export function isAutoNight(now: Date, known: KnownTimings | null): boolean {
  if (known) {
    try {
      const today = todayISOInZone(now, known.timezone);
      const age = daysBetweenISO(known.date, today);
      if (age >= 0 && age <= KNOWN_TIMINGS_MAX_AGE_DAYS) {
        const pt = known.prayerTimes;
        const t = timingsFromPrayerTimes(pt, today, known.timezone, pt.fajr);
        // Times that are not in day order (e.g. answered for another zone) cannot be trusted.
        if (t && t.fajr < t.maghrib && t.maghrib < t.isha) return getPrayerPhase(now, t).isNight;
      }
    } catch {
      // Invalid timezone or malformed cache: use the fallback.
    }
  }
  return isFallbackNight(now);
}

const HHMM = /^\d{1,2}:\d{2}/;

/** Validates an unknown (parsed JSON) value as KnownTimings. */
export function parseKnownTimings(value: unknown): KnownTimings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const pt = v.prayerTimes as Record<string, unknown> | undefined;
  if (typeof v.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return null;
  if (typeof v.timezone !== "string" || !v.timezone) return null;
  if (!pt || typeof pt !== "object") return null;
  for (const k of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const) {
    if (typeof pt[k] !== "string" || !HHMM.test(pt[k] as string)) return null;
  }
  return {
    date: v.date,
    timezone: v.timezone,
    prayerTimes: pt as unknown as KnownPrayerTimes,
    source: v.source === "geo" ? "geo" : "tz",
  };
}

// ── Storage (browser only; never throws) ──────────────

export function readKnownTimings(): KnownTimings | null {
  try {
    const raw = localStorage.getItem(KNOWN_TIMINGS_KEY);
    return raw ? parseKnownTimings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Remember the timings a screen just fetched (`/api/timings` response). A same-day "geo" entry is not replaced
 * by a "tz" one, since the location-based times are the better source.
 */
export function rememberTimings(
  data: { prayerTimes: KnownPrayerTimes; timezone: string },
  source: KnownTimings["source"],
  now: Date = new Date(),
): void {
  try {
    const date = todayISOInZone(now, data.timezone);
    const existing = readKnownTimings();
    if (source === "tz" && existing?.source === "geo" && existing.date === date) return;
    const { fajr, sunrise, dhuhr, asr, maghrib, isha, sehri } = data.prayerTimes;
    const entry: KnownTimings = {
      date,
      timezone: data.timezone,
      prayerTimes: { fajr, sunrise, dhuhr, asr, maghrib, isha, sehri },
      source,
    };
    if (!parseKnownTimings(entry)) return;
    localStorage.setItem(KNOWN_TIMINGS_KEY, JSON.stringify(entry));
    window.dispatchEvent(new Event(KNOWN_TIMINGS_EVENT));
  } catch {
    // Storage unavailable (private mode, quota): Auto mode keeps using the fallback.
  }
}

/**
 * Inline pre-hydration script for Auto mode. Runs after next-themes' own script (which renders Auto as Light),
 * and switches to Night when the cached Maghrib/Fajr (or the 18:00–05:30 fallback) says so, so night users see
 * no Light flash. It reads the cached HH:mm on the device clock; the React controller refines it after mount.
 */
export const AUTO_NIGHT_SCRIPT = `try{if(localStorage.getItem("theme")==="auto"){var d=new Date(),m=d.getHours()*60+d.getMinutes(),s=${FALLBACK_NIGHT_START_MIN},e=${FALLBACK_NIGHT_END_MIN};try{var k=JSON.parse(localStorage.getItem("${KNOWN_TIMINGS_KEY}")||"null"),p=function(x){var r=/^(\\d{1,2}):(\\d{2})/.exec(x||"");return r?(+r[1])*60+(+r[2]):null};if(k&&k.prayerTimes){var a=p(k.prayerTimes.maghrib),b=p(k.prayerTimes.fajr);if(a!==null&&b!==null){s=a;e=b}}}catch(_){}if(m>=s||m<e){var h=document.documentElement;h.classList.remove("light");h.classList.add("dark");h.style.colorScheme="dark";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content","#0B1F24")}}}catch(_){}`;
