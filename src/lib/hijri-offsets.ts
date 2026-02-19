// Hijri offsets per country and helpers to resolve offsets for a location

export const HIJRI_OFFSETS: Record<string, number> = {
  TH: -1,
  IN: -1,
  BD: -1,
  PK: -1,
  SA: 0,
  AE: 0,
  DEFAULT: 0,
};

export const HIJRI_TIMEZONE_OFFSETS: Record<string, number> = {
  // --- South & Southeast Asia (-1 Day) ---
  "Asia/Bangkok": -1,
  "Asia/Jakarta": -1,
  "Asia/Kuala_Lumpur": -1,
  "Asia/Dhaka": -1,
  "Asia/Kolkata": -1,
  "Asia/Karachi": -1,
  "Asia/Kabul": -1,
  "Asia/Colombo": -1,
  "Asia/Singapore": -1,

  // --- Middle East & North Africa (0 Days) ---
  "Asia/Riyadh": 0,
  "Asia/Dubai": 0,
  "Asia/Qatar": 0,
  "Asia/Kuwait": 0,
  "Asia/Bahrain": 0,
  "Asia/Baghdad": 0,
  "Asia/Amman": 0,
  "Africa/Cairo": 0,

  // --- Exceptions in the Middle East ---
  "Asia/Muscat": -1,

  // --- Western Hemisphere & Europe (Defaults to 0) ---
  "Europe/London": 0,
  "America/New_York": 0,
  "America/Chicago": 0,
  "America/Los_Angeles": 0,
  "America/Toronto": 0,
  "Australia/Sydney": -1,

  // --- Default Fallback ---
  DEFAULT: 0,
};

type CountryBounds = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  countryCode: string;
};

const COUNTRY_BOUNDS: CountryBounds[] = [
  // Thailand
  { latMin: 5, latMax: 21, lngMin: 97, lngMax: 106, countryCode: "TH" },
  // Saudi Arabia
  { latMin: 16, latMax: 33, lngMin: 34, lngMax: 56, countryCode: "SA" },
];

export function getConfiguredHijriOffset(): number | null {
  const raw = process.env.HIJRI_OFFSET?.trim();
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return null;

  // AlAdhan adj is typically a small correction window.
  return Math.max(-2, Math.min(2, parsed));
}

export function getHijriOffsetForLocation(countryCode: string): number {
  const configured = getConfiguredHijriOffset();
  if (configured !== null) return configured;

  const key = countryCode.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(HIJRI_OFFSETS, key)
    ? HIJRI_OFFSETS[key]
    : HIJRI_OFFSETS.DEFAULT;
}

export function getHijriOffsetForTimezone(tz: string): number {
  const configured = getConfiguredHijriOffset();
  if (configured !== null) return configured;

  if (Object.prototype.hasOwnProperty.call(HIJRI_TIMEZONE_OFFSETS, tz)) {
    return HIJRI_TIMEZONE_OFFSETS[tz];
  }

  return HIJRI_TIMEZONE_OFFSETS.DEFAULT;
}

export function getCountryCodeForCoordinates(
  latitude: number,
  longitude: number,
): string | undefined {
  for (const bounds of COUNTRY_BOUNDS) {
    if (
      latitude >= bounds.latMin &&
      latitude <= bounds.latMax &&
      longitude >= bounds.lngMin &&
      longitude <= bounds.lngMax
    ) {
      return bounds.countryCode;
    }
  }
  return undefined;
}

export function getHijriOffsetForCoordinates(
  latitude: number,
  longitude: number,
): number {
  const configured = getConfiguredHijriOffset();
  if (configured !== null) return configured;

  const countryCode = getCountryCodeForCoordinates(latitude, longitude);
  if (countryCode) {
    return getHijriOffsetForLocation(countryCode);
  }

  return HIJRI_TIMEZONE_OFFSETS.DEFAULT;
}

export function getHijriAdjustmentParams(offset: number): string {
  if (offset === 0) return "";
  return `&calendarMethod=MATHEMATICAL&adjustment=${offset}`;
}

// A small timezone -> country mapping for common timezones we care about.
// This helps when the API caller provides only a tz string (e.g. Asia/Bangkok).
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "Asia/Bangkok": "TH",
  "Asia/Dhaka": "BD",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Karachi": "PK",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Jakarta": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kabul": "AF",
  "Asia/Colombo": "LK",
  "Asia/Singapore": "SG",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Bahrain": "BH",
  "Asia/Baghdad": "IQ",
  "Asia/Amman": "JO",
  "Africa/Cairo": "EG",
  "Asia/Muscat": "OM",
  "Europe/London": "GB",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "Australia/Sydney": "AU",
};

export function getCountryCodeForTimezone(timezone?: string): string | undefined {
  if (!timezone) return undefined;
  if (Object.prototype.hasOwnProperty.call(TIMEZONE_TO_COUNTRY, timezone)) {
    return TIMEZONE_TO_COUNTRY[timezone];
  }
  // Try simple heuristics: last segment might be a city we know
  const parts = timezone.split("/");
  const city = parts[parts.length - 1];
  const rev: Record<string, string> = {
    Bangkok: "TH",
    Dhaka: "BD",
    Karachi: "PK",
    Riyadh: "SA",
    Dubai: "AE",
    Kolkata: "IN",
    Calcutta: "IN",
  };
  return rev[city];
}
