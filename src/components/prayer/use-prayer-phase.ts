import { useCallback, useSyncExternalStore } from "react";
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

export const isBnLocale = (locale: string) => locale.toLowerCase().startsWith("bn");

const clockFormats = new Map<string, Intl.DateTimeFormat>();
function clockFormat(timeZone: string): Intl.DateTimeFormat {
  let f = clockFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hourCycle: "h12" });
    clockFormats.set(timeZone, f);
  }
  return f;
}

/**
 * Wall-clock time of `at` in `timeZone`, 12-hour "h:mm" without a day-period suffix
 * (the label beside it says which prayer it is). Bengali digits in bn, Latin otherwise.
 * The formatter is cached per zone (digits are localised afterwards, so the locale is not part of the key).
 */
export function formatPrayerClock(at: Date, timeZone: string, locale: string): string {
  const parts = clockFormat(timeZone).formatToParts(at);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const text = `${hour}:${minute}`;
  return isBnLocale(locale) ? toBengaliDigits(text) : text;
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

function subscribeClock(listener: () => void): () => void {
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
