// Prayer-time calculation by country: which AlAdhan method and Asr school a place uses, and the request
// parameters for it. Ids checked against api.aladhan.com/v1/methods. Shared by the server (AlAdhan requests,
// /api param validation) and the client (Settings, the request params it sends).
import { ALADHAN_TUNE } from "@/lib/fast-times";

/** AlAdhan method ids the app accepts (every real method; 6 does not exist, 99 "custom" is not offered). */
export const METHOD_IDS = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 7] as const;
export type MethodId = (typeof METHOD_IDS)[number];
/** 0 = Standard (Shafi'i, Maliki, Hanbali), 1 = Hanafi. */
export type School = 0 | 1;

export interface CalcMethod {
  method: MethodId;
  school: School;
}

const KARACHI_HANAFI: CalcMethod = { method: 1, school: 1 };
const MWL: CalcMethod = { method: 3, school: 0 };

/** The approved country -> method mapping (ISO 3166-1 alpha-2). Anything else is MWL + Standard. */
const COUNTRY_METHODS: Record<string, CalcMethod> = {
  BD: KARACHI_HANAFI,
  PK: KARACHI_HANAFI,
  IN: KARACHI_HANAFI,
  AF: KARACHI_HANAFI,
  TH: MWL,
  MY: { method: 17, school: 0 }, // JAKIM
  SG: { method: 11, school: 0 }, // MUIS
  ID: { method: 20, school: 0 }, // Kemenag
  SA: { method: 4, school: 0 }, // Umm al-Qura
  AE: { method: 16, school: 0 }, // Dubai
  QA: { method: 10, school: 0 },
  KW: { method: 9, school: 0 },
  EG: { method: 5, school: 0 }, // Egyptian General Authority of Survey
  TR: { method: 13, school: 0 }, // Diyanet
  US: { method: 2, school: 0 }, // ISNA
  CA: { method: 2, school: 0 },
};

export function defaultMethodForCountry(country: string | undefined): CalcMethod {
  return COUNTRY_METHODS[country?.toUpperCase() ?? ""] ?? MWL;
}

export function isMethodId(n: unknown): n is MethodId {
  return typeof n === "number" && (METHOD_IDS as readonly number[]).includes(n);
}

export function isSchool(n: unknown): n is School {
  return n === 0 || n === 1;
}

export function isCountryCode(cc: unknown): cc is string {
  return typeof cc === "string" && /^[A-Z]{2}$/.test(cc);
}

/** What one request needs: the country (for defaults, the BD tune and the Hijri offset) and optional overrides. */
export interface CalcOptions {
  country?: string;
  method?: MethodId;
  school?: School;
  /** The user's Hijri date adjustment in days (-2..2), added to the country's offset. */
  hijriAdjust?: number;
}

/** The method and school a request uses: explicit overrides, else the country's default. */
export function resolveCalc(opts: CalcOptions = {}): CalcMethod {
  const d = defaultMethodForCountry(opts.country);
  return { method: opts.method ?? d.method, school: opts.school ?? d.school };
}

/**
 * AlAdhan query parameters. Bangladesh keeps the IFB-calibrated tune (see fast-times.ts), so a BD request is exactly
 * `method=1&school=1&tune=7,0,0,0,0,2,0,0,0`; no other country is tuned.
 */
export function aladhanParams(opts: CalcOptions = {}): string {
  const { method, school } = resolveCalc(opts);
  const tune = opts.country?.toUpperCase() === "BD" ? `&tune=${ALADHAN_TUNE}` : "";
  return `method=${method}&school=${school}${tune}`;
}
