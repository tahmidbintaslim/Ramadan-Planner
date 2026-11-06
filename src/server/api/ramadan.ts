// Server-only handler for GET /api/ramadan, ported from src/app/api/ramadan/route.ts.
import "@tanstack/react-start/server-only";
import { getRamadanStatus } from "@/lib/ramadan-date";
import { getCountryCodeForCoordinates, getCountryCodeForTimezone } from "@/lib/hijri-offsets";
import { guarded, isValidDateParam, isValidTimeZoneParam, json } from "./http";

export const RAMADAN_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=300";

export function handleRamadan(request: Request): Promise<Response> {
  return guarded("api/ramadan", () => run(request));
}

async function run(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get("tz") ?? "Asia/Dhaka";
  if (!isValidTimeZoneParam(timezone)) {
    return json({ error: "Invalid timezone" }, { status: 400 });
  }
  // `date` (the client's local YYYY-MM-DD) only keys the CDN cache, so it changes at local midnight; the status
  // is computed for today in `tz`.
  const date = searchParams.get("date");
  if (date !== null && !isValidDateParam(date)) {
    return json({ error: "Invalid date" }, { status: 400 });
  }
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const countryQuery = searchParams.get("cc") ?? undefined;
  const latitude = latParam ? Number.parseFloat(latParam) : null;
  const longitude = lngParam ? Number.parseFloat(lngParam) : null;
  const hasCoordinates =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const countryFromCoords = hasCoordinates
    ? getCountryCodeForCoordinates(latitude, longitude)
    : undefined;
  const inferredCountry =
    countryQuery ?? countryFromCoords ?? getCountryCodeForTimezone(timezone);

  try {
    const status = await getRamadanStatus(
      timezone,
      inferredCountry,
      hasCoordinates ? { latitude, longitude } : undefined,
    );
    return json(status, { headers: { "Cache-Control": RAMADAN_CACHE_CONTROL } });
  } catch (error) {
    console.error("Ramadan status error:", error);
    return json({ error: "Failed to fetch Ramadan status" }, { status: 502 });
  }
}
