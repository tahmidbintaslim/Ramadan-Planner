// Pure reminder-time helpers shared by the server dispatcher (push-schedule.ts) and the browser (guest reminders
// while the app is open). No Node or DOM imports.

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
