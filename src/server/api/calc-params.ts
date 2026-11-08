// The calculation params the timings routes accept (method, school, cc, hadj), validated against allowlists so no
// arbitrary string reaches AlAdhan or fragments the CDN cache. Absent ones default from the place's country.
import { isCountryCode, isMethodId, isSchool, type CalcOptions } from "@/lib/calc-method";

/** Query keys these params use (keep each route's own allowlist in sync). */
export const CALC_PARAM_KEYS = ["method", "school", "cc", "hadj"] as const;

const int = (raw: string): number | null => (/^-?\d{1,2}$/.test(raw) ? Number(raw) : null);

/** The CalcOptions in `searchParams`, or an error message for a value outside the allowlist. */
export function calcFromSearchParams(searchParams: URLSearchParams): { calc: CalcOptions } | { error: string } {
  const calc: CalcOptions = {};
  const method = searchParams.get("method");
  if (method !== null) {
    const n = int(method);
    if (!isMethodId(n)) return { error: "Invalid method" };
    calc.method = n;
  }
  const school = searchParams.get("school");
  if (school !== null) {
    const n = int(school);
    if (!isSchool(n)) return { error: "Invalid school" };
    calc.school = n;
  }
  const cc = searchParams.get("cc");
  if (cc !== null) {
    if (!isCountryCode(cc)) return { error: "Invalid country" };
    calc.country = cc;
  }
  const hadj = searchParams.get("hadj");
  if (hadj !== null) {
    const n = int(hadj);
    if (n === null || Math.abs(n) > 2) return { error: "Invalid Hijri adjustment" };
    calc.hijriAdjust = n;
  }
  return { calc };
}
