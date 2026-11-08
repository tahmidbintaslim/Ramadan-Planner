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
import { calcRequestParams, readStoredLocation, subscribeStoredLocation } from "@/lib/user-location";
import { fetchCached, useCached } from "@/lib/data-cache";
import { deviceTimeZone, homeRequestUrls } from "@/components/today/use-home-timings";

// Small, once-a-day data the app shell needs: the user's known prayer timings (Auto Night) and the Ramadan day
// (top bar caption). Both use the stored location, else the device timezone (no geolocation prompt from the
// shell), with the stored country's calculation, spelled exactly as the Home spells them (homeRequestUrls), so
// both go through one entry of the shared data cache: navigation never refetches and the Home never asks twice.
// Screens that fetch better (location-based) timings call rememberTimings(data, "geo"); the shell re-reads on
// KNOWN_TIMINGS_EVENT.

/** The Home's request URLs for today at the stored location (else the device zone). Browser only. */
export function shellUrls(): ReturnType<typeof homeRequestUrls> {
  const loc = readStoredLocation();
  const tz = loc?.tz ?? deviceTimeZone();
  return homeRequestUrls(tz, todayISOInZone(new Date(), tz), loc ?? undefined, calcRequestParams(loc));
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

/** Last known timings; when `enabled` and none are cached for today, fetches today's /api/timings (shared cache). */
export function useKnownTimings(enabled: boolean): KnownTimings | null {
  const raw = useStoredRaw(KNOWN_TIMINGS_KEY, KNOWN_TIMINGS_EVENT);
  const known = useMemo(() => parseKnownTimings(safeParse(raw)), [raw]);

  useEffect(() => {
    if (!enabled) return;
    const cached = readKnownTimings();
    if (cached && cached.date === todayISOInZone(new Date(), cached.timezone)) return;
    let live = true;
    const urls = shellUrls();
    const tz = new URL(urls.today, "http://x").searchParams.get("tz")!;
    fetchCached<TimingData>(urls.today)
      .then((data) => {
        if (live && data?.prayerTimes) rememberTimings({ prayerTimes: data.prayerTimes, timezone: data.timezone || tz }, "tz");
      })
      .catch(() => {
        // Offline or upstream down: Auto keeps the cached or fallback window.
      });
    return () => {
      live = false;
    };
  }, [enabled]);

  return known;
}

/** Current Ramadan day (1-30), or null outside Ramadan / while unknown. One cached request per local day. */
export function useRamadanDay(): number | null {
  // The URL carries today's date: any render after local midnight asks for the new day.
  const url = useSyncExternalStore(subscribeStoredLocation, () => shellUrls().ramadan, () => null);
  const { data } = useCached<{ phase?: string; currentDay?: number | null }>(url);
  return data?.phase === "ramadan" && typeof data.currentDay === "number" && data.currentDay >= 1 && data.currentDay <= 30
    ? data.currentDay
    : null;
}
