import { useCallback, useEffect, useState } from "react";
import type { TimingData } from "@/types/database";
import type { RamadanStatus } from "@/lib/ramadan-date";
import { readKnownTimings, rememberTimings } from "@/lib/auto-night";
import { todayISOInZone } from "@/lib/prayer-phase";
import { calcRequestParams, readStoredLocation, subscribeStoredLocation, type StoredLocation } from "@/lib/user-location";

export type HomeTimingsStatus = "loading" | "ready" | "error";

export interface HomeTimings {
  status: HomeTimingsStatus;
  /** Today's timings from /api/timings, or the last known (cached) ones when offline (`cached`). */
  timings: TimingData | null;
  /** Tomorrow's timings (tomorrow's fajr and sehri end), or null when unavailable. */
  tomorrow: TimingData | null;
  /** True when `timings` came from the local cache, not a fresh answer: the hero labels it as sample. */
  cached: boolean;
  ramadan: RamadanStatus | null;
  /** The location chosen at onboarding (read after mount), or null: device zone, then the device position. */
  location: StoredLocation | null;
}

/** Coordinates rounded to 2 decimals (about 1 km): plenty for prayer times, kinder to privacy and the CDN cache. */
export function coarseCoord(value: number): string {
  return value.toFixed(2);
}

/**
 * The Home's requests for one local day. Every URL carries the date, so the CDN (cached per URL for an hour)
 * cannot answer a just-after-midnight request with yesterday's entry. /api/timings reads `date`; /api/ramadan
 * computes "today" itself and only validates `date`, which keys the cache.
 */
export function homeRequestUrls(
  tz: string,
  todayISO: string,
  coords?: { lat: number; lng: number },
  calc: Record<string, string> = {},
): { today: string; tomorrow: string; ramadan: string } {
  const base = new URLSearchParams({ tz });
  if (coords) {
    base.set("lat", coarseCoord(coords.lat));
    base.set("lng", coarseCoord(coords.lng));
  }
  // Country, method, school and Hijri adjustment (calcRequestParams); the server defaults any that are absent.
  for (const [k, v] of Object.entries(calc)) base.set(k, v);
  const withParam = (key: string, value: string) => {
    const p = new URLSearchParams(base);
    p.set(key, value);
    return p.toString();
  };
  return {
    today: `/api/timings?${withParam("date", todayISO)}`,
    tomorrow: `/api/timings?${withParam("date", nextDayISO(todayISO))}`,
    ramadan: `/api/ramadan?${withParam("date", todayISO)}`,
  };
}

/** "2027-02-20" → "2027-02-21". */
export function nextDayISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
  } catch {
    return "Asia/Dhaka";
  }
}

/** "Asia/Dhaka" → "Dhaka", like the server's label fallback (not imported: keeps server code out of the bundle). */
function zoneCity(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

function getPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 }),
  );
}

/** Today's cached timings (Auto Night store) as a minimal TimingData, for offline use. */
function cachedTimings(tz: string): TimingData | null {
  const known = readKnownTimings();
  if (!known) return null;
  try {
    if (known.date !== todayISOInZone(new Date(), known.timezone)) return null;
  } catch {
    return null;
  }
  const pt = known.prayerTimes;
  return {
    prayerTimes: {
      ...pt,
      sunrise: pt.sunrise ?? "",
      sehri: pt.sehri ?? pt.fajr,
      iftar: pt.maghrib,
    },
    hijriDate: { day: "", month: "", year: "", monthAr: "", monthBn: "" },
    gregorianDate: known.date,
    timezone: known.timezone,
    location: zoneCity(known.timezone || tz),
  };
}

/**
 * Home data: today's timings and the Ramadan status. With a location chosen at onboarding (district or coarse
 * device position) the requests use it and nothing prompts. Without one: first the device timezone (fast, no
 * prompt), then refined with the device location when the user allows it.
 * Refetches when `todayISO` changes (local midnight) and when the stored location changes (the location sheet).
 * `enabled: false` holds every request. `fallback` stands in when nothing is stored (the landing page: Dhaka, so it
 * never prompts for geolocation). Fresh timings are remembered for Auto Night mode.
 */
export function useHomeTimings(
  todayISO: string,
  { enabled = true, fallback }: { enabled?: boolean; fallback?: StoredLocation } = {},
): HomeTimings & { retry: () => void } {
  const [state, setState] = useState<HomeTimings>({
    status: "loading",
    timings: null,
    tomorrow: null,
    cached: false,
    ramadan: null,
    location: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: "loading" }));
    setAttempt((n) => n + 1);
  }, []);
  // A new location (saved from the location sheet) refetches; the current times stay until the new ones arrive.
  useEffect(() => subscribeStoredLocation(() => setAttempt((n) => n + 1)), []);

  useEffect(() => {
    // Nothing is fetched (and nothing prompts) until the caller says so, e.g. while the first-run gate decides.
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    // Effects run only in the browser, after hydration: reading localStorage here cannot cause a mismatch.
    const own = readStoredLocation();
    const stored = own ?? fallback ?? null;
    const tz = stored?.tz ?? deviceTimeZone();

    const json = async <T,>(res: Response | null): Promise<T | null> =>
      res?.ok ? ((await res.json().catch(() => null)) as T | null) : null;
    const valid = (d: TimingData | null) => (d?.prayerTimes ? d : null);

    const load = async (coords?: { lat: number; lng: number }) => {
      const urls = homeRequestUrls(tz, todayISO, coords, calcRequestParams(stored));
      const [timingsRes, tomorrowRes, ramadanRes] = await Promise.all([
        fetch(urls.today, { signal }).catch(() => null),
        fetch(urls.tomorrow, { signal }).catch(() => null),
        fetch(urls.ramadan, { signal }).catch(() => null),
      ]);
      return {
        timings: valid(await json<TimingData>(timingsRes)),
        tomorrow: valid(await json<TimingData>(tomorrowRes)),
        ramadan: await json<RamadanStatus>(ramadanRes),
      };
    };

    const run = async () => {
      const first = await load(stored ? { lat: stored.lat, lng: stored.lng } : undefined);
      if (signal.aborted) return;
      if (first.timings) {
        // Fallback (landing) times are not this visitor's: Auto Night keeps its own.
        if (own || !fallback) rememberTimings(first.timings, stored ? "geo" : "tz");
        setState({
          status: "ready",
          timings: first.timings,
          tomorrow: first.tomorrow,
          cached: false,
          ramadan: first.ramadan,
          location: stored,
        });
      } else {
        const offline = cachedTimings(tz);
        setState((prev) =>
          prev.timings && !prev.cached
            ? prev
            : offline
              ? { status: "ready", timings: offline, tomorrow: null, cached: true, ramadan: first.ramadan ?? prev.ramadan, location: stored }
              : { status: "error", timings: null, tomorrow: null, cached: false, ramadan: first.ramadan ?? prev.ramadan, location: stored },
        );
      }

      // A chosen location is final: no geolocation prompt on the Home.
      if (stored) return;
      const pos = await getPosition();
      if (!pos || signal.aborted) return;
      const better = await load({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (signal.aborted || !better.timings) return;
      rememberTimings(better.timings, "geo");
      setState((prev) => ({
        status: "ready",
        timings: better.timings,
        tomorrow: better.tomorrow ?? prev.tomorrow,
        cached: false,
        ramadan: better.ramadan ?? prev.ramadan,
        location: null,
      }));
    };

    void run();
    return () => controller.abort();
    // `fallback` is a module constant at its one call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, attempt, enabled]);

  return { ...state, retry };
}
