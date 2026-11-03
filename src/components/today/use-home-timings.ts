import { useCallback, useEffect, useState } from "react";
import type { TimingData } from "@/types/database";
import type { RamadanStatus } from "@/lib/ramadan-date";
import { readKnownTimings, rememberTimings } from "@/lib/auto-night";
import { todayISOInZone } from "@/lib/prayer-phase";

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
 * Home data: today's timings and the Ramadan status, first for the device timezone (fast, no prompt), then
 * refined with the device location when the user allows it (the same flow the Today and Dashboard screens used).
 * Refetches when `todayISO` changes (local midnight). Fresh timings are remembered for Auto Night mode.
 */
export function useHomeTimings(todayISO: string): HomeTimings & { retry: () => void } {
  const [state, setState] = useState<HomeTimings>({
    status: "loading",
    timings: null,
    tomorrow: null,
    cached: false,
    ramadan: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: "loading" }));
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const tz = deviceTimeZone();

    const json = async <T,>(res: Response | null): Promise<T | null> =>
      res?.ok ? ((await res.json().catch(() => null)) as T | null) : null;
    const valid = (d: TimingData | null) => (d?.prayerTimes ? d : null);

    const load = async (params: URLSearchParams) => {
      // Tomorrow's times (for the after-Isha sehri/fajr countdown) are one more cached request.
      const tomorrowParams = new URLSearchParams(params);
      const tomorrowISO = nextDayISO(todayISOInZone(new Date(), tz));
      tomorrowParams.set("date", tomorrowISO);
      const [timingsRes, tomorrowRes, ramadanRes] = await Promise.all([
        fetch(`/api/timings?${params}`, { signal }).catch(() => null),
        fetch(`/api/timings?${tomorrowParams}`, { signal }).catch(() => null),
        fetch(`/api/ramadan?${params}`, { signal }).catch(() => null),
      ]);
      return {
        timings: valid(await json<TimingData>(timingsRes)),
        tomorrow: valid(await json<TimingData>(tomorrowRes)),
        ramadan: await json<RamadanStatus>(ramadanRes),
      };
    };

    const run = async () => {
      const base = new URLSearchParams({ tz });
      const first = await load(base);
      if (signal.aborted) return;
      if (first.timings) {
        rememberTimings(first.timings, "tz");
        setState({
          status: "ready",
          timings: first.timings,
          tomorrow: first.tomorrow,
          cached: false,
          ramadan: first.ramadan,
        });
      } else {
        const offline = cachedTimings(tz);
        setState((prev) =>
          prev.timings && !prev.cached
            ? prev
            : offline
              ? { status: "ready", timings: offline, tomorrow: null, cached: true, ramadan: first.ramadan ?? prev.ramadan }
              : { status: "error", timings: null, tomorrow: null, cached: false, ramadan: first.ramadan ?? prev.ramadan },
        );
      }

      const pos = await getPosition();
      if (!pos || signal.aborted) return;
      const geo = new URLSearchParams({ tz, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
      const better = await load(geo);
      if (signal.aborted || !better.timings) return;
      rememberTimings(better.timings, "geo");
      setState((prev) => ({
        status: "ready",
        timings: better.timings,
        tomorrow: better.tomorrow,
        cached: false,
        ramadan: better.ramadan ?? prev.ramadan,
      }));
    };

    void run();
    return () => controller.abort();
  }, [todayISO, attempt]);

  return { ...state, retry };
}
