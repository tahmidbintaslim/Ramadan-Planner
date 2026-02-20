"use client";

const DATE_SUFFIX_RE = /_(\d{4}-\d{2}-\d{2})$/;

function parseDateSuffix(key: string): Date | null {
  const match = key.match(DATE_SUFFIX_RE);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function pruneLocalHistory(prefixWithRp: string, keepDays = 7) {
  if (typeof window === "undefined") return;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const cutoff = new Date(start);
  cutoff.setUTCDate(cutoff.getUTCDate() - (keepDays - 1));

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(`${prefixWithRp}_`)) continue;
      const date = parseDateSuffix(key);
      if (!date) continue;
      if (date < cutoff) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage errors.
  }
}
