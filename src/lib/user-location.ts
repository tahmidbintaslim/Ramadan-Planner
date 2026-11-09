// The guest's chosen location (first-run onboarding), kept on the device only (localStorage). The Home reads it
// to request /api/timings for that place without a geolocation prompt.
import { DEFAULT_DISTRICT_ID, districtById, nearestDistrict, type District } from "@/lib/districts";
import { defaultMethodForCountry, isCountryCode, isMethodId, isSchool, type MethodId, type School } from "@/lib/calc-method";
import { getCountryCodeForCoordinates, getCountryCodeForTimezone } from "@/lib/hijri-offsets";

export const LOCATION_STORAGE_KEY = "rp_location";
/** Bangladesh's zone: district times are requested for it whatever the device zone is. */
export const BD_TIME_ZONE = "Asia/Dhaka";

/** district = picked from the list; geo = the device position (coarse); city = a place found by search; default = "later", Dhaka. */
export type LocationKind = "district" | "geo" | "city" | "default";

/** v2 adds the place name, country and calculation; a stored v1 value is migrated when read. */
export interface StoredLocation {
  v: 2;
  kind: LocationKind;
  /** The district picked, or the one nearest the device position (none outside Bangladesh). */
  districtId?: string;
  /** Coordinates rounded to 2 decimals. */
  lat: number;
  lng: number;
  /** IANA zone for the timings request. */
  tz: string;
  /** Place name (a searched city's, or the zone's city for a device position); districts are named from districtId. */
  label?: string;
  /** ISO 3166-1 alpha-2 country: picks the calculation method and the Hijri offset. */
  country?: string;
  /** AlAdhan method and Asr school (the country's default, or the user's choice in Settings). */
  method?: MethodId;
  school?: School;
  savedAt: string;
}

/** The country's default method and school, as stored with a new location. */
function withCountry(country: string | undefined): Pick<StoredLocation, "country" | "method" | "school"> {
  return country ? { country, ...defaultMethodForCountry(country) } : { ...defaultMethodForCountry(undefined) };
}

/** The country of a zone (offline, from the tz database's zones), else of the coarse coordinates. */
export function countryForPlace(tz: string, lat: number, lng: number): string | undefined {
  return getCountryCodeForTimezone(tz) ?? getCountryCodeForCoordinates(lat, lng);
}

/** "Asia/Dhaka" -> "Dhaka". */
export function zoneCity(tz: string): string {
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

/** Round to 2 decimals (about 1 km): enough for prayer times, kinder to privacy and the CDN cache. */
export function coarse(value: number): number {
  return Math.round(value * 100) / 100;
}

export function locationFromDistrict(d: District, kind: "district" | "default" = "district", now = new Date()): StoredLocation {
  return {
    v: 2,
    kind,
    districtId: d.id,
    lat: coarse(d.lat),
    lng: coarse(d.lng),
    tz: BD_TIME_ZONE,
    ...withCountry("BD"),
    savedAt: now.toISOString(),
  };
}

/** A place found by the city search (Open-Meteo geocoding). */
export function locationFromCity(
  city: { name: string; country_code?: string; latitude: number; longitude: number; timezone?: string },
  now = new Date(),
): StoredLocation | null {
  if (!isValidTimeZone(city.timezone)) return null;
  const cc = city.country_code?.toUpperCase();
  const country = isCountryCode(cc) ? cc : countryForPlace(city.timezone, city.latitude, city.longitude);
  return {
    v: 2,
    kind: "city",
    lat: coarse(city.latitude),
    lng: coarse(city.longitude),
    tz: city.timezone,
    label: city.name.slice(0, 80),
    ...withCountry(country),
    savedAt: now.toISOString(),
  };
}

/** The "পরে করব" choice: Dhaka, marked as the default so the UI can say so. */
export function defaultLocation(now = new Date()): StoredLocation {
  return locationFromDistrict(districtById(DEFAULT_DISTRICT_ID)!, "default", now);
}

/** Within this distance of a district town (and on a Bangladesh-zone device) a position is named after it. */
export const DISTRICT_LABEL_RADIUS_KM = 25;

/** True for a zone the runtime knows (an IANA name such as "Asia/Dhaka"). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * A device position. The times use the device's own zone (a position just over the border, e.g. Agartala or
 * Siliguri, keeps Asia/Kolkata). It is named after the nearest district only on a Bangladesh-zone device and
 * within DISTRICT_LABEL_RADIUS_KM of the district town.
 */
export function locationFromCoords(lat: number, lng: number, deviceTz: string, now = new Date()): StoredLocation {
  const tz = isValidTimeZone(deviceTz) ? deviceTz : BD_TIME_ZONE;
  const near = tz === BD_TIME_ZONE || tz === "Asia/Dacca" ? nearestDistrict(lat, lng, DISTRICT_LABEL_RADIUS_KM) : undefined;
  return {
    v: 2,
    kind: "geo",
    ...(near ? { districtId: near.id } : {}),
    lat: coarse(lat),
    lng: coarse(lng),
    tz,
    // No free reverse geocoder without a key (Open-Meteo has none): the zone's city names the place.
    label: zoneCity(tz),
    ...withCountry(near ? "BD" : countryForPlace(tz, lat, lng)),
    savedAt: now.toISOString(),
  };
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Parse a stored value (v2, or v1 migrated); anything malformed is treated as "no location" (onboarding shows again). */
export function parseStoredLocation(raw: string | null | undefined): StoredLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Omit<Partial<StoredLocation>, "v"> & { v?: number };
    if (v?.v !== 1 && v?.v !== 2) return null;
    if (!["district", "geo", "default", ...(v.v === 2 ? ["city"] : [])].includes(v.kind as string)) return null;
    if (!finite(v.lat) || !finite(v.lng) || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
    if (!isValidTimeZone(v.tz)) return null;
    if (v.districtId !== undefined && !districtById(v.districtId)) return null;
    if ((v.kind === "district" || v.kind === "default") && !v.districtId) return null;
    // A v1 value (or a v2 one without these) gets its country from the district, else the zone, and that
    // country's defaults; stored choices are kept when valid.
    const country = isCountryCode(v.country)
      ? v.country
      : v.districtId && v.kind !== "geo"
        ? "BD"
        : countryForPlace(v.tz, v.lat, v.lng);
    const d = withCountry(country);
    const label = typeof v.label === "string" && v.label ? v.label.slice(0, 80) : v.kind === "geo" ? zoneCity(v.tz) : undefined;
    return {
      v: 2,
      kind: v.kind as LocationKind,
      ...(v.districtId ? { districtId: v.districtId } : {}),
      lat: coarse(v.lat),
      lng: coarse(v.lng),
      tz: v.tz,
      ...(label ? { label } : {}),
      ...(country ? { country } : {}),
      method: isMethodId(v.method) ? v.method : d.method,
      school: isSchool(v.school) ? v.school : d.school,
      savedAt: typeof v.savedAt === "string" ? v.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function readStoredLocation(): StoredLocation | null {
  try {
    return parseStoredLocation(localStorage.getItem(LOCATION_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Fired on window after the location is saved, so mounted screens (header, Today) follow at once. */
export const LOCATION_EVENT = "rp:location";

export function writeStoredLocation(loc: StoredLocation): boolean {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
    return true;
  } catch {
    return false;
  } finally {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCATION_EVENT));
  }
}

/** Subscribe to location changes (this tab's saves and other tabs' storage writes). */
export function subscribeStoredLocation(onChange: () => void): () => void {
  // Only this module's keys (or a full clear, key null): any other tab's write (a tasbih count every second, the
  // data cache) used to restart the Today load, geolocation included.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LOCATION_STORAGE_KEY || e.key === HIJRI_ADJUST_KEY) onChange();
  };
  window.addEventListener(LOCATION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LOCATION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Clerk keeps `__client_uat` (seconds of the last sign-in, "0" when signed out) on the app's domain. A non-zero
 * value means a session exists, which is known before clerk-js has loaded.
 */
export function signedInFromCookie(cookie: string): boolean {
  const m = /(?:^|;\s*)__client_uat=([^;]*)/.exec(cookie);
  const n = m ? Number.parseInt(decodeURIComponent(m[1]), 10) : 0;
  return Number.isFinite(n) && n > 0;
}

/** First-run gate: only a guest without a stored location is sent to onboarding; signed-in users never are. */
export function shouldOnboard({ hasLocation, signedIn }: { hasLocation: boolean; signedIn: boolean }): boolean {
  return !hasLocation && !signedIn;
}

export type GateDecision = "wait" | "clear" | "onboard";

/** How long the gate waits for the auth client before treating the visitor as a guest (as the planner does). */
export const GUEST_AUTH_WAIT_MS = 3000;

/**
 * The Home's first-run gate, decided once per mount. A stored location or a signed-in cookie clears it at once.
 * Otherwise it waits for the auth client: a resolved signed-in user clears it, a resolved guest (or an auth
 * client that has not answered within the guest timeout) is onboarded.
 */
export function gateDecision(input: {
  hasLocation: boolean;
  cookieSignedIn: boolean;
  authLoading: boolean;
  signedIn: boolean;
  authTimedOut: boolean;
  /** No Clerk session cookie at all (signed out), known before the auth client loads. */
  cookieMissing?: boolean;
}): GateDecision {
  if (input.hasLocation || input.cookieSignedIn) return "clear";
  // No session cookie is already "signed out": a first visit goes straight to onboarding instead of waiting up to
  // 3 s for the auth client (the plan list trusts the same cookie).
  if (input.authLoading && !input.authTimedOut && !input.cookieMissing) return "wait";
  if (!input.authLoading && input.signedIn) return "clear";
  return "onboard";
}

/** Request parameters for the stored location, for screens that would otherwise prompt for geolocation. */
export function storedRequestLocation(): { tz: string; lat: number; lng: number } | null {
  const loc = readStoredLocation();
  return loc ? { tz: loc.tz, lat: loc.lat, lng: loc.lng } : null;
}

// ── Hijri date adjustment (device setting, -2..2 days) ──

export const HIJRI_ADJUST_KEY = "rp_hijri_adjust";

export function readHijriAdjust(): number {
  try {
    const n = Number(localStorage.getItem(HIJRI_ADJUST_KEY));
    return Number.isInteger(n) && Math.abs(n) <= 2 ? n : 0;
  } catch {
    return 0;
  }
}

/** Saves the adjustment and fires LOCATION_EVENT, so screens refetch as they do for a new location. */
export function writeHijriAdjust(days: number): void {
  try {
    if (days === 0) localStorage.removeItem(HIJRI_ADJUST_KEY);
    else localStorage.setItem(HIJRI_ADJUST_KEY, String(Math.max(-2, Math.min(2, Math.trunc(days)))));
  } catch {
    // Storage unavailable: the adjustment stays 0.
  } finally {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCATION_EVENT));
  }
}

/**
 * The calculation params every timings request sends (/api/timings, /api/ramadan, /api/ramadan-timetable): the
 * stored location's country, method and school, and the device's Hijri adjustment. Without a stored location
 * only the adjustment is sent; the server takes the country from the zone.
 */
export function calcRequestParams(loc: StoredLocation | null | undefined, hijriAdjust = readHijriAdjust()): Record<string, string> {
  const p: Record<string, string> = {};
  if (loc?.country) p.cc = loc.country;
  if (loc?.method !== undefined) p.method = String(loc.method);
  if (loc?.school !== undefined) p.school = String(loc.school);
  if (hijriAdjust) p.hadj = String(hijriAdjust);
  return p;
}

// Set once the visitor finishes or skips onboarding in this page session, so a failed write (full storage)
// cannot send them straight back to it.
let doneThisSession = false;

export function markOnboardingDone(): void {
  doneThisSession = true;
}

/** True once onboarding was finished or skipped in this page session. */
export function onboardingDoneThisSession(): boolean {
  return doneThisSession;
}

/** True when this device's choice can be read (blocked storage would loop the visitor back to onboarding). */
export function locationStorageReadable(): boolean {
  try {
    localStorage.getItem(LOCATION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous browser check for client navigations (the route's beforeLoad), from storage and the cookie only.
 * False on the server and whenever storage cannot be read.
 */
export function needsOnboarding(signedIn = false): boolean {
  if (typeof window === "undefined" || doneThisSession) return false;
  try {
    // An unreadable store (blocked storage) would loop the visitor back to onboarding: never gate then.
    localStorage.getItem(LOCATION_STORAGE_KEY);
  } catch {
    return false;
  }
  return shouldOnboard({
    hasLocation: readStoredLocation() !== null,
    signedIn: signedIn || signedInFromCookie(document.cookie),
  });
}
