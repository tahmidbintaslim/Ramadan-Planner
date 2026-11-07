/**
 * Auto Night mode: when the theme preference is "auto", Night (the `.dark` class) applies from Maghrib to Fajr.
 *
 * The decision (`autoNightAt`) applies the phase engine's isNight rule (before Fajr or from Maghrib) to the user's
 * last known timings, cached in localStorage by whichever screen fetched them. Without usable timings it falls
 * back to a fixed local window, 18:00 to 05:30. Pure apart from the small storage helpers, which never throw.
 */

import type { PrayerTimes } from "@/types/database";
import { todayISOInZone } from "@/lib/prayer-phase";

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

/**
 * THE Auto Night decision, shared by the React controller (`isAutoNight`) and the pre-hydration script
 * (`AUTO_NIGHT_SCRIPT` embeds this function's source), so both always agree.
 *
 * Night = before Fajr or from Maghrib, on the device's wall clock: the same rule as `getPrayerPhase(...).isNight`
 * (sehri + night phases; see the equivalence test). The cached times are used only when they are for the device's
 * own timezone (so wall-clock comparison is exact), at most 7 days old, and in day order (Fajr before Maghrib);
 * otherwise the 18:00–05:30 fallback applies.
 *
 * Must stay self-contained (no imports, no module-level references, plain syntax): it is serialized with
 * `toString()`. The literals mirror FALLBACK_NIGHT_* and KNOWN_TIMINGS_MAX_AGE_DAYS (asserted in tests).
 */
export function autoNightAt(nowMs: number, deviceTimeZone: string | undefined, cached: unknown): boolean {
  const now = new Date(nowMs);
  const minute = now.getHours() * 60 + now.getMinutes();
  let start = 1080;
  let end = 330;
  try {
    const k = cached as { date?: unknown; timezone?: unknown; prayerTimes?: { fajr?: unknown; maghrib?: unknown } } | null;
    const hm = function (x: unknown): number | null {
      const r = typeof x === "string" ? /^(\d{1,2}):(\d{2})/.exec(x) : null;
      return r ? Number(r[1]) * 60 + Number(r[2]) : null;
    };
    if (k && typeof k === "object" && deviceTimeZone && k.timezone === deviceTimeZone && k.prayerTimes) {
      const d = typeof k.date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(k.date) : null;
      const fajr = hm(k.prayerTimes.fajr);
      const maghrib = hm(k.prayerTimes.maghrib);
      if (d && fajr !== null && maghrib !== null && fajr < maghrib) {
        const age = Math.round(
          (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]))) /
            86400000,
        );
        if (age >= 0 && age <= 7) {
          start = maghrib;
          end = fajr;
        }
      }
    }
  } catch {
    // Malformed cache: keep the fallback window.
  }
  return minute >= start || minute < end;
}

/** The device's IANA timezone, or undefined when Intl cannot tell. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Fixed-window fallback, in the device's local time. */
export function isFallbackNight(now: Date): boolean {
  return autoNightAt(now.getTime(), undefined, null);
}

/** Whether Auto mode should show Night at `now` (see `autoNightAt`). */
export function isAutoNight(now: Date, known: KnownTimings | null, timeZone: string | undefined = deviceTimeZone()): boolean {
  return autoNightAt(now.getTime(), timeZone, known);
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
 * Inline pre-hydration script for Auto mode. Runs after next-themes' own script (which renders Auto as Light) and
 * switches to Night when `autoNightAt` (embedded verbatim) says so, so night users see no Light flash and the
 * React controller, which calls the same function, never disagrees after mount.
 */
export const AUTO_NIGHT_SCRIPT = `try{if(localStorage.getItem("theme")==="auto"){var z,k=null;try{z=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(_){}try{k=JSON.parse(localStorage.getItem("${KNOWN_TIMINGS_KEY}")||"null")}catch(_){}if((${autoNightAt.toString()})(Date.now(),z,k)){var h=document.documentElement;h.classList.remove("light");h.classList.add("dark");h.style.colorScheme="dark";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content","#0B1A17")}}}catch(_){}`;
