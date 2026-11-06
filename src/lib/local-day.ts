// The user's local calendar day, for day-scoped device storage (guest trackers: rp_<family>_<YYYY-MM-DD>) and for
// the date the signed-in planner saves under. Local means the zone of the stored location (onboarding), else the
// device zone, else Asia/Dhaka: a Dhaka guest's day turns at local midnight, not at 00:00 UTC (06:00 in Dhaka).
import { todayISOInZone } from "@/lib/prayer-phase";
import { BD_TIME_ZONE, isValidTimeZone, readStoredLocation } from "@/lib/user-location";

/** The device's IANA zone, or null when the runtime cannot tell. */
export function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/** The zone the local day is counted in: stored location, then device, then Asia/Dhaka. */
export function localTimeZone(): string {
  const stored = typeof window === "undefined" ? null : readStoredLocation();
  return stored?.tz ?? deviceTimeZone() ?? BD_TIME_ZONE;
}

/** Today's local calendar date (YYYY-MM-DD). */
export function localTodayISO(now: Date = new Date(), timeZone: string = localTimeZone()): string {
  try {
    return todayISOInZone(now, timeZone);
  } catch {
    return todayISOInZone(now, BD_TIME_ZONE);
  }
}

/** `iso` moved by `days` calendar days. */
export function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The day-scoped storage key (without the rp_ prefix) for today: `${prefix}_${YYYY-MM-DD}`. */
export function localDayKey(prefix: string, now: Date = new Date(), timeZone?: string): string {
  return `${prefix}_${localTodayISO(now, timeZone)}`;
}

// ── One-time migration from the old UTC day keys ──

/** Families (key prefixes, with rp_) already checked for a UTC-keyed entry. */
export const LOCAL_DAY_MIGRATION_KEY = "rp_local_day_migrated_v1";
const DATED_KEY = /^(.+)_(\d{4}-\d{2}-\d{2})$/;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function migratedFamilies(storage: StorageLike): string[] {
  try {
    const v = JSON.parse(storage.getItem(LOCAL_DAY_MIGRATION_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Day keys used to be the UTC date, so around local midnight today's entry sat under another date. Once per family:
 * when today's local entry (`fullKey`, e.g. rp_salah_2026-03-05) is empty and the entry for today's UTC date exists,
 * copy it, so nothing ticked just before this change disappears. The UTC entry is never deleted (the 7-day prune
 * expires it). Returns true when it copied. Never throws.
 */
export function migrateUtcDayKey(
  fullKey: string,
  now: Date = new Date(),
  storage: StorageLike | undefined = typeof window === "undefined" ? undefined : window.localStorage,
): boolean {
  if (!storage) return false;
  try {
    const m = DATED_KEY.exec(fullKey);
    if (!m) return false;
    const [, family, dateISO] = m;
    // Only today's key migrates: an older or newer day has no UTC counterpart to inherit.
    if (dateISO !== localTodayISO(now)) return false;
    const done = migratedFamilies(storage);
    if (done.includes(family)) return false;
    const utcISO = now.toISOString().slice(0, 10);
    let copied = false;
    if (utcISO !== dateISO && storage.getItem(fullKey) === null) {
      const legacy = storage.getItem(`${family}_${utcISO}`);
      if (legacy !== null) {
        storage.setItem(fullKey, legacy);
        copied = true;
      }
    }
    storage.setItem(LOCAL_DAY_MIGRATION_KEY, JSON.stringify([...done, family]));
    return copied;
  } catch {
    return false;
  }
}
