// Server-only handler for GET /api/ramadan-timetable, ported from src/app/api/ramadan-timetable/route.ts.
import "@tanstack/react-start/server-only";
import { fetchRamadanTimetable } from "@/lib/ramadan-timetable";
import { DHAKA_DEFAULTS, locationLabelFromTimezone } from "@/lib/prayer-times";
import { guarded, json } from "./http";
import { TIMEZONE_DEFAULT_COORDS } from "./timezone-defaults";

export const RAMADAN_TIMETABLE_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

export function handleRamadanTimetable(request: Request): Promise<Response> {
  return guarded("api/ramadan-timetable", () => run(request));
}

async function run(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const timezone = searchParams.get("tz") ?? DHAKA_DEFAULTS.timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return json({ error: "Invalid timezone" }, { status: 400 });
  }

  // Prefer explicit coordinates, otherwise use timezone-based defaults where available
  const lat = parseFloat(
    searchParams.get("lat") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.latitude ?? DHAKA_DEFAULTS.latitude),
  );
  const lng = parseFloat(
    searchParams.get("lng") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.longitude ?? DHAKA_DEFAULTS.longitude),
  );
  // Hijri year is auto-detected by the timetable service now
  const hijriYear = searchParams.get("year") ?? "";

  // Derive location label: prefer explicit `location`, then timezone-derived label, then Dhaka fallback
  const location =
    searchParams.get("location") ??
    (TIMEZONE_DEFAULT_COORDS[timezone]?.label ?? locationLabelFromTimezone(timezone) ?? DHAKA_DEFAULTS.locationLabel);

  if (isNaN(lat) || isNaN(lng)) {
    return json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const timetable = await fetchRamadanTimetable(lat, lng, hijriYear, timezone, location);
    return json(timetable, { headers: { "Cache-Control": RAMADAN_TIMETABLE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Ramadan timetable error:", error);
    return json({ error: "Failed to fetch Ramadan timetable" }, { status: 502 });
  }
}
