// Server-only handler for GET /api/timings, ported from src/app/api/timings/route.ts.
import "@tanstack/react-start/server-only";
import {
  fetchPrayerTimes,
  DHAKA_DEFAULTS,
  todayDateString,
  locationLabelFromTimezone,
} from "@/lib/prayer-times";
import { guarded, isValidDateParam, isValidTimeZoneParam, json } from "./http";
import { TIMEZONE_DEFAULT_COORDS } from "./timezone-defaults";

export const TIMINGS_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=300";

/** YYYY-MM-DD (validated) to AlAdhan's DD-MM-YYYY. */
function normalizeAlAdhanDate(rawDate: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}-${month}-${year}`;
  }
  return rawDate;
}

export function handleTimings(request: Request): Promise<Response> {
  return guarded("api/timings", () => run(request));
}

async function run(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const timezone = searchParams.get("tz") ?? DHAKA_DEFAULTS.timezone;
  if (!isValidTimeZoneParam(timezone)) {
    return json({ error: "Invalid timezone" }, { status: 400 });
  }
  // Clients send their local date (YYYY-MM-DD), so the CDN cache key changes at local midnight.
  const rawDate = searchParams.get("date");
  if (rawDate !== null && !isValidDateParam(rawDate)) {
    return json({ error: "Invalid date" }, { status: 400 });
  }

  const lat = parseFloat(
    searchParams.get("lat") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.latitude ?? DHAKA_DEFAULTS.latitude),
  );
  const lng = parseFloat(
    searchParams.get("lng") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.longitude ?? DHAKA_DEFAULTS.longitude),
  );

  // Derive location label: use explicit param, or auto-detect from timezone
  const location =
    searchParams.get("location") ??
    (TIMEZONE_DEFAULT_COORDS[timezone]?.label ?? locationLabelFromTimezone(timezone) ?? DHAKA_DEFAULTS.locationLabel);

  const date = rawDate ? normalizeAlAdhanDate(rawDate) : todayDateString(timezone);

  // Basic validation
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "Invalid latitude or longitude" }, { status: 400 });
  }

  try {
    const data = await fetchPrayerTimes(lat, lng, date, timezone, location);
    return json(data, { headers: { "Cache-Control": TIMINGS_CACHE_CONTROL } });
  } catch (error) {
    console.error("Prayer times fetch error:", error);
    return json({ error: "Failed to fetch prayer times" }, { status: 502 });
  }
}
