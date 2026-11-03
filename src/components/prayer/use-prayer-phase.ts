import { useEffect, useState } from "react";
import {
  formatRemainingBn,
  formatRemainingEn,
  getPrayerPhase,
  toBengaliDigits,
  todayISOInZone,
  type PhaseTimings,
  type PrayerPhaseResult,
} from "@/lib/prayer-phase";

/** How often the live clock ticks. */
export const PRAYER_TICK_MS = 30_000;

/** The five daily prayers in order, as used by the list and the reminder rule types. */
export const FIVE_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type FivePrayer = (typeof FIVE_PRAYERS)[number];

const isBn = (locale: string) => locale.toLowerCase().startsWith("bn");

/**
 * Wall-clock time of `at` in `timeZone`, 12-hour "h:mm" without a day-period suffix
 * (the label beside it says which prayer it is). Bengali digits in bn, Latin otherwise.
 */
export function formatPrayerClock(at: Date, timeZone: string, locale: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const text = `${hour}:${minute}`;
  return isBn(locale) ? toBengaliDigits(text) : text;
}

/** "আর ২ ঘণ্টা ১৪ মিনিট" in bn, "2h 14m left" otherwise. */
export function formatRemaining(ms: number, locale: string): string {
  return isBn(locale) ? formatRemainingBn(ms) : formatRemainingEn(ms);
}

/**
 * A live clock: the current time, refreshed every 30 s while the page is visible
 * (paused while `document.hidden`, refreshed at once when it comes back).
 * Passing `override` freezes the clock at that instant (tests, previews) and starts no timer.
 */
export function useNowTick(override?: Date): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  const frozen = override !== undefined;

  useEffect(() => {
    if (frozen) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => setNow(new Date());
    const start = () => {
      if (id === null) id = setInterval(tick, PRAYER_TICK_MS);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [frozen]);

  return override ?? now;
}

export interface UsePrayerPhaseResult {
  now: Date;
  /** Null when no timings are available yet. */
  phase: PrayerPhaseResult | null;
  /** Today's calendar date (YYYY-MM-DD) in `timeZone`; changes at local midnight so callers can refetch. */
  todayISO: string;
}

/** Wraps the pure phase engine with the live 30 s clock. */
export function usePrayerPhase(
  timings: PhaseTimings | null | undefined,
  timeZone: string,
  options: { now?: Date } = {},
): UsePrayerPhaseResult {
  const now = useNowTick(options.now);
  return {
    now,
    phase: timings ? getPrayerPhase(now, timings) : null,
    todayISO: todayISOInZone(now, timeZone),
  };
}
