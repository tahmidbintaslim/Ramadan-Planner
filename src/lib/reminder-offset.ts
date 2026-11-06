import { parseLocalizedNumber } from "./locale-number";

/** The offset range the reminder schemas accept (minutes before or after the prayer time). */
export const OFFSET_LIMIT = 720;

/**
 * A reminder offset typed in either digit set ("-১৫", "+15", "0"): a whole number of minutes within
 * ±OFFSET_LIMIT, otherwise null (empty, "-", "1.5", text, out of range), so it is never saved as 0 by accident.
 */
export function parseOffsetMinutes(text: string): number | null {
  const n = parseLocalizedNumber(text);
  if (n === null || !Number.isInteger(n) || Math.abs(n) > OFFSET_LIMIT) return null;
  return n === 0 ? 0 : n;
}
