import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { TimingData } from "@/types/database";
import {
  KNOWN_TIMINGS_EVENT,
  KNOWN_TIMINGS_KEY,
  parseKnownTimings,
  readKnownTimings,
  rememberTimings,
  type KnownTimings,
} from "@/lib/auto-night";
import { todayISOInZone } from "@/lib/prayer-phase";

// Small, once-a-day data the app shell needs: the user's known prayer timings (Auto Night) and the Ramadan day
// (top bar caption). Both use the device timezone only (no geolocation prompt from the shell) and are cached in
// localStorage, so navigation never refetches. Screens that fetch better (location-based) timings call
// rememberTimings(data, "geo"); the shell re-reads on KNOWN_TIMINGS_EVENT.

const RAMADAN_DAY_KEY = "rp_shell_ramadan_day";
const RAMADAN_DAY_EVENT = "rp:ramadan-day";

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
  } catch {
    return "Asia/Dhaka";
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A localStorage entry as a React external store (re-read on our own event and on other tabs' writes). */
function useStoredRaw(key: string, event: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(event, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(event, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => readRaw(key),
    () => null,
  );
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Last known timings; when `enabled` and none are cached for today, fetches /api/timings for the device timezone. */
export function useKnownTimings(enabled: boolean): KnownTimings | null {
  const raw = useStoredRaw(KNOWN_TIMINGS_KEY, KNOWN_TIMINGS_EVENT);
  const known = useMemo(() => parseKnownTimings(safeParse(raw)), [raw]);

  useEffect(() => {
    if (!enabled) return;
    const tz = deviceTimeZone();
    const cached = readKnownTimings();
    if (cached && cached.date === todayISOInZone(new Date(), cached.timezone)) return;
    const controller = new AbortController();
    fetch(`/api/timings?${new URLSearchParams({ tz, date: todayISOInZone(new Date(), tz) })}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<TimingData>) : null))
      .then((data) => {
        if (data?.prayerTimes) rememberTimings({ prayerTimes: data.prayerTimes, timezone: data.timezone || tz }, "tz");
      })
      .catch(() => {
        // Offline or upstream down: Auto keeps the cached or fallback window.
      });
    return () => controller.abort();
  }, [enabled]);

  return known;
}

/** Current Ramadan day (1-30), or null outside Ramadan / while unknown. Fetched at most once per local day. */
export function useRamadanDay(): number | null {
  const raw = useStoredRaw(RAMADAN_DAY_KEY, RAMADAN_DAY_EVENT);
  const cached = useMemo(() => safeParse(raw) as { date?: string; day?: unknown } | null, [raw]);

  useEffect(() => {
    const tz = deviceTimeZone();
    const today = todayISOInZone(new Date(), tz);
    const current = safeParse(readRaw(RAMADAN_DAY_KEY)) as { date?: string } | null;
    if (current?.date === today) return;
    const controller = new AbortController();
    fetch(`/api/ramadan?${new URLSearchParams({ tz, date: today })}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ phase?: string; currentDay?: number | null }>) : null))
      .then((data) => {
        if (!data) return;
        const day =
          data.phase === "ramadan" && typeof data.currentDay === "number" && data.currentDay >= 1 && data.currentDay <= 30
            ? data.currentDay
            : null;
        try {
          localStorage.setItem(RAMADAN_DAY_KEY, JSON.stringify({ date: today, day }));
          window.dispatchEvent(new Event(RAMADAN_DAY_EVENT));
        } catch {
          // Storage unavailable: no caption suffix.
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // A cached day from an earlier date is stale (the effect refetches); never show it.
  if (!cached || typeof cached.day !== "number") return null;
  try {
    return cached.date === todayISOInZone(new Date(), deviceTimeZone()) ? cached.day : null;
  } catch {
    return null;
  }
}
