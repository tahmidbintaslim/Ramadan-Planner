// Worldwide city search for the location picker: Open-Meteo's free geocoding API (no key, CORS-enabled), called from
// the browser. Only name, country, coordinates and zone are kept; anything malformed is dropped.
import { isValidTimeZone } from "@/lib/user-location";

export const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

export interface CityResult {
  id: number;
  name: string;
  /** Region and country, for telling same-named places apart. */
  detail: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** Keeps the usable results of an Open-Meteo search response. */
export function parseCityResults(body: unknown): CityResult[] {
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const out: CityResult[] = [];
  for (const r of results as Record<string, unknown>[]) {
    const { id, name, latitude, longitude, timezone, country, admin1, country_code } = r ?? {};
    if (typeof name !== "string" || !name || typeof latitude !== "number" || typeof longitude !== "number") continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isValidTimeZone(timezone)) continue;
    const detail = [admin1, country].filter((s): s is string => typeof s === "string" && s !== "" && s !== name).join(", ");
    out.push({
      id: typeof id === "number" ? id : out.length,
      name,
      detail,
      ...(typeof country_code === "string" ? { country_code } : {}),
      latitude,
      longitude,
      timezone,
    });
  }
  return out;
}

/** Up to 8 places matching `name`, named in `lang` (bn or en). Throws on a network or HTTP error. */
export async function searchCities(name: string, lang: "bn" | "en", signal?: AbortSignal): Promise<CityResult[]> {
  const params = new URLSearchParams({ name: name.trim().slice(0, 80), count: "8", language: lang, format: "json" });
  const res = await fetch(`${GEOCODING_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  return parseCityResults(await res.json());
}
