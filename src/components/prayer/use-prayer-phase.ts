import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import {
  DEFAULT_CLOCK_FORMAT,
  clockParts,
  joinClockParts,
  wallClock,
  type ClockFormat,
  type ClockParts,
} from "@/lib/clock-format";
import {
  formatRemainingBn,
  formatRemainingEn,
  getPrayerPhase,
  todayISOInZone,
  type PhaseTimings,
  type PrayerPhaseResult,
} from "@/lib/prayer-phase";

/** How often the live clock ticks. */
export const PRAYER_TICK_MS = 30_000;

/** The five daily prayers in order, as used by the list and the reminder rule types. */
export const FIVE_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type FivePrayer = (typeof FIVE_PRAYERS)[number];

export const isBnLocale = (locale: string) => locale.toLowerCase().startsWith("bn");

/** The parts of the wall-clock time of `at` in `timeZone`, in the user's clock format (see src/lib/clock-format.ts). */
export function prayerClockParts(at: Date, timeZone: string, locale: string, format: ClockFormat = DEFAULT_CLOCK_FORMAT): ClockParts {
  const { hour, minute } = wallClock(at, timeZone);
  return clockParts(hour, minute, locale, format);
}

/**
 * Wall-clock time of `at` in `timeZone` as one string in the user's clock format: "5:55 PM" / "৫:৫৫" (12-hour,
 * the default; "রাত ৩:১০" from 00:00 to 03:59 in bn) or "17:55" / "১৭:৫৫" (24-hour). Locale digits.
 */
export function formatPrayerClock(at: Date, timeZone: string, locale: string, format: ClockFormat = DEFAULT_CLOCK_FORMAT): string {
  return joinClockParts(prayerClockParts(at, timeZone, locale, format));
}

/** "আর ২ ঘণ্টা ১৪ মিনিট" in bn, "2h 14m left" otherwise. */
export function formatRemaining(ms: number, locale: string): string {
  return isBnLocale(locale) ? formatRemainingBn(ms) : formatRemainingEn(ms);
}

// ── Shared live clock (one interval for every subscriber) ──

const listeners = new Set<() => void>();
let clockMs = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;

function notify() {
  clockMs = Date.now();
  listeners.forEach((l) => l());
}
function startInterval() {
  if (intervalId === null) intervalId = setInterval(notify, PRAYER_TICK_MS);
}
function stopInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
function onVisibility() {
  if (document.hidden) {
    stopInterval();
  } else {
    notify();
    startInterval();
  }
}

/** Subscribes to the shared live clock (one 30 s interval for every subscriber, paused while hidden). */
export function subscribeClock(listener: () => void): () => void {
  // Refresh on (re)subscribe: React re-reads the snapshot after subscribing, so a component that
  // mounts, hydrates or switches from a frozen to a live clock shows the current time at once.
  clockMs = Date.now();
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) startInterval();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}
const noopSubscribe = () => () => {};

/** Current clock value. With no subscribers the cached value may be stale, so refresh it (at most once a second, keeping successive reads in one render equal). */
function readClock(): number {
  if (listeners.size === 0 && Date.now() - clockMs >= 1000) clockMs = Date.now();
  return clockMs;
}

/**
 * The live clock, but a component re-renders only when `key(now)` changes (a day, phase or night boundary),
 * not on every 30 s tick. For screens that derive state from the time but show no ticking countdown.
 */
export function useClockWhen(key: (now: Date) => string, initialNow?: Date): Date {
  const last = useRef<{ key: string; ms: number } | null>(null);
  const initialMs = initialNow?.getTime();
  const getSnapshot = () => {
    const ms = readClock();
    const k = key(new Date(ms));
    if (last.current?.key !== k) last.current = { key: k, ms };
    return last.current.ms;
  };
  const getServerSnapshot = useCallback(() => initialMs ?? readClock(), [initialMs]);
  const ms = useSyncExternalStore(subscribeClock, getSnapshot, getServerSnapshot);
  return useMemo(() => new Date(ms), [ms]);
}

/**
 * A live clock: the current time, refreshed every 30 s while the page is visible
 * (paused while `document.hidden`, refreshed at once when it comes back).
 *
 * Hydration-safe: the server render and the hydrating client render both use `initialNow`
 * (pass the server's render time, e.g. from the route loader); the live time takes over right
 * after hydration. Without `initialNow` the first render uses the clock as read at that moment.
 * `override` freezes the clock at that instant (tests, previews) and subscribes to nothing.
 */
export function useNowTick(override?: Date, initialNow?: Date): Date {
  const frozenMs = override?.getTime();
  const initialMs = initialNow?.getTime();
  const frozen = frozenMs !== undefined;
  const subscribe = frozen ? noopSubscribe : subscribeClock;
  const getSnapshot = useCallback(() => frozenMs ?? readClock(), [frozenMs]);
  const getServerSnapshot = useCallback(() => frozenMs ?? initialMs ?? readClock(), [frozenMs, initialMs]);
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return new Date(ms);
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
  options: { now?: Date; initialNow?: Date } = {},
): UsePrayerPhaseResult {
  const now = useNowTick(options.now, options.initialNow);
  return {
    now,
    phase: timings ? getPrayerPhase(now, timings) : null,
    todayISO: todayISOInZone(now, timeZone),
  };
}
