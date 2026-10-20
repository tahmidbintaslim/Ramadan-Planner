// Pure scheduling helpers for /api/push/dispatch, kept free of DB and network
// access so the due-window logic can be unit-tested.

import { timingSafeEqual } from "node:crypto";
import { fromZonedTime } from "date-fns-tz";

/**
 * How often the scheduler calls GET /api/push/dispatch
 * (.github/workflows/reminders-cron.yml runs every 5 minutes).
 */
export const DISPATCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Extra time a reminder stays due after one interval. GitHub Actions often
 * starts scheduled runs a few minutes late; the overlap keeps those
 * reminders from being skipped, and push_delivery_logs' unique
 * (subscription, rule, scheduled_for) index stops a second send.
 */
export const SCHEDULER_GRACE_MS = 5 * 60 * 1000;

/**
 * A reminder is sent by the first run within this long after it falls due.
 * It must be at least DISPATCH_INTERVAL_MS or reminders between two runs are
 * never sent (the old 2-minute window with a daily cron sent almost nothing).
 */
export const DUE_WINDOW_MS = DISPATCH_INTERVAL_MS + SCHEDULER_GRACE_MS;

export interface RulePrayerTimes {
  sehri: string;
  iftar: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export function parseTime(value: string): { h: number; m: number } | null {
  const [hRaw, mRaw] = value.split(":");
  const h = Number.parseInt(hRaw, 10);
  const m = Number.parseInt(mRaw, 10);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/** Shift an HH:mm time by offsetMinutes, wrapping around midnight. */
export function applyOffset(time: string, offsetMinutes: number): string | null {
  const parsed = parseTime(time);
  if (!parsed) return null;
  const total = parsed.h * 60 + parsed.m + offsetMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function baseTimeForRule(
  type: string,
  prayerTimes: RulePrayerTimes,
): string | null {
  switch (type) {
    case "sehri":
      return prayerTimes.sehri;
    case "iftar":
      return prayerTimes.iftar;
    case "fajr":
      return prayerTimes.fajr;
    case "dhuhr":
      return prayerTimes.dhuhr;
    case "asr":
      return prayerTimes.asr;
    case "maghrib":
      return prayerTimes.maghrib;
    case "isha":
      return prayerTimes.isha;
    case "taraweeh":
      return prayerTimes.isha;
    case "tahajjud":
      return "03:00";
    default:
      return null;
  }
}

/** True when scheduledAt is in the half-open window (now - windowMs, now]. */
export function isDue(
  scheduledAt: Date,
  now: Date,
  windowMs: number = DUE_WINDOW_MS,
): boolean {
  const diff = now.getTime() - scheduledAt.getTime();
  return diff >= 0 && diff < windowMs;
}

/** YYYY-MM-DD of an instant in the given IANA time zone. */
export function localDateIso(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/**
 * Find the occurrence of a daily reminder at local time `localTime` (HH:mm)
 * that is due at `now`, or null. Both the local date of `now` and the local
 * date at the start of the window are checked, so a reminder just before
 * local midnight is still sent by a run just after it.
 */
export function findDueOccurrence(
  localTime: string,
  timeZone: string,
  now: Date,
  windowMs: number = DUE_WINDOW_MS,
): Date | null {
  if (!parseTime(localTime)) return null;

  const days = new Set([
    localDateIso(new Date(now.getTime() - windowMs), timeZone),
    localDateIso(now, timeZone),
  ]);

  for (const day of days) {
    const scheduledAt = fromZonedTime(`${day}T${localTime}:00`, timeZone);
    if (isDue(scheduledAt, now, windowMs)) return scheduledAt;
  }
  return null;
}

/**
 * Constant-time check of an `Authorization: Bearer <secret>` header.
 * Returns false when the secret is unset, so an unconfigured deployment
 * rejects every call.
 */
export function hasBearerSecret(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  const expected = secret?.trim();
  if (!expected || !authorization) return false;

  const given = Buffer.from(authorization);
  const wanted = Buffer.from(`Bearer ${expected}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
