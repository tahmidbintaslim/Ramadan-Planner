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
import { CALC_PARAM_KEYS, calcFromSearchParams } from "./calc-params";

export const TIMINGS_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=300";

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

const ALLOWED_PARAMS = new Set<string>(["tz", "date", "lat", "lng", "location", ...CALC_PARAM_KEYS]);

/** Upstream quota guard: only the app's own params (no cache-busting extras), a date within a year of today. */
export function timingsParamError(searchParams: URLSearchParams, now = new Date()): string | null {
  for (const key of searchParams.keys()) if (!ALLOWED_PARAMS.has(key)) return "Unknown parameter";
  const date = searchParams.get("date");
  if (date && Math.abs(Date.parse(date) - now.getTime()) > 400 * 86_400_000) return "Date out of range";
  if ((searchParams.get("location") ?? "").length > 120) return "Invalid location";
  const calc = calcFromSearchParams(searchParams);
  if ("error" in calc) return calc.error;
  return null;
}

async function run(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const paramError = timingsParamError(searchParams);
  if (paramError) return json({ error: paramError }, { status: 400 });

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
    // About 1 km: enough for prayer times, and nearby callers share one upstream request.
    const round = (n: number) => Math.round(n * 100) / 100;
    const parsed = calcFromSearchParams(searchParams);
    const calc = "calc" in parsed ? parsed.calc : {};
    const data = await fetchPrayerTimes(round(lat), round(lng), date, timezone, location, calc);
    return json(data, { headers: { "Cache-Control": TIMINGS_CACHE_CONTROL } });
  } catch (error) {
    console.error("Prayer times fetch error:", error);
    return json({ error: "Failed to fetch prayer times" }, { status: 502 });
  }
}
