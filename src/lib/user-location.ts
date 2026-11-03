// The guest's chosen location (first-run onboarding), kept on the device only (localStorage). The Home reads it
// to request /api/timings for that place without a geolocation prompt.
import { DEFAULT_DISTRICT_ID, districtById, nearestDistrict, type District } from "@/lib/districts";

export const LOCATION_STORAGE_KEY = "rp_location";
/** Bangladesh's zone: district times are requested for it whatever the device zone is. */
export const BD_TIME_ZONE = "Asia/Dhaka";

export type LocationKind = "district" | "geo" | "default";

export interface StoredLocation {
  v: 1;
  /** district = picked from the list; geo = the device position (coarse); default = "later", Dhaka. */
  kind: LocationKind;
  /** The district picked, or the one nearest the device position (none outside Bangladesh). */
  districtId?: string;
  /** Coordinates rounded to 2 decimals. */
  lat: number;
  lng: number;
  /** IANA zone for the timings request. */
  tz: string;
  savedAt: string;
}

/** Round to 2 decimals (about 1 km): enough for prayer times, kinder to privacy and the CDN cache. */
export function coarse(value: number): number {
  return Math.round(value * 100) / 100;
}

export function locationFromDistrict(d: District, kind: "district" | "default" = "district", now = new Date()): StoredLocation {
  return { v: 1, kind, districtId: d.id, lat: coarse(d.lat), lng: coarse(d.lng), tz: BD_TIME_ZONE, savedAt: now.toISOString() };
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
    v: 1,
    kind: "geo",
    ...(near ? { districtId: near.id } : {}),
    lat: coarse(lat),
    lng: coarse(lng),
    tz,
    savedAt: now.toISOString(),
  };
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Parse a stored value; anything malformed is treated as "no location" (onboarding shows again). */
export function parseStoredLocation(raw: string | null | undefined): StoredLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredLocation>;
    if (v?.v !== 1 || !["district", "geo", "default"].includes(v.kind as string)) return null;
    if (!finite(v.lat) || !finite(v.lng) || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
    if (!isValidTimeZone(v.tz)) return null;
    if (v.districtId !== undefined && !districtById(v.districtId)) return null;
    if (v.kind !== "geo" && !v.districtId) return null;
    return {
      v: 1,
      kind: v.kind as LocationKind,
      ...(v.districtId ? { districtId: v.districtId } : {}),
      lat: coarse(v.lat),
      lng: coarse(v.lng),
      tz: v.tz,
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

export function writeStoredLocation(loc: StoredLocation): boolean {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
    return true;
  } catch {
    return false;
  }
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
}): GateDecision {
  if (input.hasLocation || input.cookieSignedIn) return "clear";
  if (input.authLoading && !input.authTimedOut) return "wait";
  if (!input.authLoading && input.signedIn) return "clear";
  return "onboard";
}

/** Request parameters for the stored location, for screens that would otherwise prompt for geolocation. */
export function storedRequestLocation(): { tz: string; lat: number; lng: number } | null {
  const loc = readStoredLocation();
  return loc ? { tz: loc.tz, lat: loc.lat, lng: loc.lng } : null;
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
