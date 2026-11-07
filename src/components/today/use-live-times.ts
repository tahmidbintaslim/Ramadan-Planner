import { useMemo } from "react";
import { districtById, DEFAULT_DISTRICT_ID } from "@/lib/districts";
import { BD_TIME_ZONE, locationFromDistrict } from "@/lib/user-location";
import { useStoredLocation } from "@/hooks/use-stored-location";
import { timingsFromPrayerTimes, todayISOInZone, type PhaseTimings } from "@/lib/prayer-phase";
import { usePrayerPhase } from "@/components/prayer/use-prayer-phase";
import { useHomeTimings, type HomeTimings } from "./use-home-timings";

// Dhaka, for visitors who have not chosen a district yet: the landing never prompts for geolocation.
const DHAKA = locationFromDistrict(districtById(DEFAULT_DISTRICT_ID)!, "default", new Date(0));

/**
 * Today's real times for the welcome flow and the web homepage (closes #32): the visitor's stored district, else
 * Dhaka, from the same /api/timings the Today screen uses, fetched after hydration. Until they arrive nothing is
 * shown in their place (no sample or made-up times).
 */
export function useLiveTimes(initialNow?: Date): {
  home: HomeTimings;
  phaseTimings: PhaseTimings | null;
  timeZone: string;
  now: Date;
} {
  const storedTz = useStoredLocation()?.tz;
  const { now, todayISO } = usePrayerPhase(null, storedTz ?? BD_TIME_ZONE, { initialNow });
  const home = useHomeTimings(todayISO, { fallback: DHAKA });
  const timeZone = home.timings?.timezone ?? BD_TIME_ZONE;
  const phaseTimings = useMemo(() => {
    if (!home.timings) return null;
    let dateISO: string;
    try {
      dateISO = todayISOInZone(now, timeZone);
    } catch {
      return null;
    }
    const pt = home.timings.prayerTimes;
    const next = home.tomorrow?.prayerTimes;
    return timingsFromPrayerTimes(pt, dateISO, timeZone, next?.fajr || pt.fajr, next?.sehri || pt.sehri || undefined);
    // `now` changes every tick; the date only matters at midnight, when todayISO refetches anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.timings, home.tomorrow, timeZone]);
  return { home, phaseTimings, timeZone, now };
}
