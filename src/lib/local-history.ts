"use client";

import { localTodayISO, shiftISO } from "@/lib/local-day";

/**
 * How long guest daily records are kept on the device: a full Ramadan (30 days) plus the days around it, so a
 * guest never loses earlier Ramadan progress mid-month.
 */
export const GUEST_HISTORY_DAYS = 45;

const DATE_SUFFIX_RE = /_(\d{4}-\d{2}-\d{2})$/;

/**
 * Removes `${prefixWithRp}_<YYYY-MM-DD>` entries older than `keepDays` local days (today counts as one). Days are
 * the user's local calendar days (see local-day.ts), the same dates the keys are written under.
 */
export function pruneLocalHistory(prefixWithRp: string, keepDays = GUEST_HISTORY_DAYS, todayISO: string = localTodayISO()) {
  if (typeof window === "undefined") return;
  const cutoffISO = shiftISO(todayISO, -(keepDays - 1));

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(`${prefixWithRp}_`)) continue;
      const match = key.match(DATE_SUFFIX_RE);
      // Only the family's own dated keys (rp_quran_2026-03-01, not rp_quran_last_read_v1_...).
      if (!match || key.slice(0, -match[0].length) !== prefixWithRp) continue;
      if (match[1] < cutoffISO) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage errors.
  }
}
