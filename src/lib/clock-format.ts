// Clock format preference (12-hour or 24-hour) and the one formatter every screen's times go through.
//
// 12-hour is the default (it is how Bangladesh reads the clock, in Bengali and in English). The choice is made in
// /settings and kept on this device (localStorage), for guests and signed-in users alike; nothing goes to a server.
//   en 12h: "5:55 PM"      en 24h: "17:55"
//   bn 12h: always with the Bangladeshi day period before the time (BN_DAY_PERIODS): "ভোর ৪:৫৭", "দুপুর ১২:১৪",
//           "বিকাল ৪:১৮", "সন্ধ্যা ৫:৫৮", "রাত ৭:১২", so a bare "৪:৫৭" can never be read as afternoon
//   bn 24h: "১৭:৫৫"
import { toBengaliDigits } from "@/lib/prayer-phase";

export type ClockFormat = "12h" | "24h";
export const CLOCK_FORMATS: readonly ClockFormat[] = ["12h", "24h"];
export const DEFAULT_CLOCK_FORMAT: ClockFormat = "12h";
export const CLOCK_FORMAT_KEY = "rp_clock_format";
/** Fired on window after a change, so every mounted clock re-renders at once. */
export const CLOCK_FORMAT_EVENT = "rp:clock-format";
/** The Bengali day-period word for the night (20:00/19:00 to 03:59). */
export const BN_NIGHT_PERIOD = "রাত";

/**
 * Bangladeshi day periods for bn 12-hour times, as [from minute of the day, word], in order. Boundaries (founder to
 * confirm): ভোর 04:00, সকাল 06:00, দুপুর 11:30, বিকাল 15:00, সন্ধ্যা 17:00, রাত 19:00 (until 03:59).
 * সন্ধ্যা starts at 17:00 because Bangladesh's earliest sunset (late Nov) is ~17:10: Maghrib and Iftar must never read
 * as বিকাল. দুপুর starts at 11:30 so Dhuhr (11:40-12:15 across the year) always reads as দুপুর.
 */
export const BN_DAY_PERIODS: ReadonlyArray<readonly [number, string]> = [
  [0, BN_NIGHT_PERIOD],
  [4 * 60, "ভোর"],
  [6 * 60, "সকাল"],
  [11 * 60 + 30, "দুপুর"],
  [15 * 60, "বিকাল"],
  [17 * 60, "সন্ধ্যা"],
  [19 * 60, BN_NIGHT_PERIOD],
];

/** The Bengali day period of a wall-clock time (hour 0-23). */
export function bnDayPeriod(hour: number, minute: number): string {
  const m = (hour % 24) * 60 + minute;
  let word = BN_NIGHT_PERIOD;
  for (const [from, w] of BN_DAY_PERIODS) if (m >= from) word = w;
  return word;
}

export function parseClockFormat(raw: unknown): ClockFormat {
  return raw === "24h" || raw === "12h" ? raw : DEFAULT_CLOCK_FORMAT;
}

/** Used when localStorage is unavailable: the choice then lasts for this page session. */
let memoryFormat: ClockFormat | null = null;

export function readClockFormat(): ClockFormat {
  if (memoryFormat) return memoryFormat;
  try {
    return parseClockFormat(localStorage.getItem(CLOCK_FORMAT_KEY));
  } catch {
    return DEFAULT_CLOCK_FORMAT;
  }
}

export function writeClockFormat(format: ClockFormat): void {
  try {
    localStorage.setItem(CLOCK_FORMAT_KEY, format);
    memoryFormat = null;
  } catch {
    memoryFormat = format;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOCK_FORMAT_EVENT));
}

export function subscribeClockFormat(onChange: () => void): () => void {
  window.addEventListener(CLOCK_FORMAT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CLOCK_FORMAT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export interface ClockParts {
  /** "5:55", "17:55", "৫:৫৫" (locale digits). */
  time: string;
  /** "AM"/"PM" (en 12h), the Bangladeshi day period (bn 12h: ভোর, সকাল, দুপুর, বিকাল, সন্ধ্যা, রাত), null in 24h. */
  period: string | null;
  /** Where the period goes: after the time in English, before it in Bengali. */
  periodFirst: boolean;
}

const isBn = (locale: string) => locale.toLowerCase().startsWith("bn");

/** The pieces of a wall-clock time given as hour (0-23) and minute. */
export function clockParts(hour: number, minute: number, locale: string, format: ClockFormat = DEFAULT_CLOCK_FORMAT): ClockParts {
  const bn = isBn(locale);
  const mm = String(minute).padStart(2, "0");
  let time: string;
  let period: string | null = null;
  if (format === "24h") {
    time = `${String(hour).padStart(2, "0")}:${mm}`;
  } else {
    time = `${hour % 12 || 12}:${mm}`;
    if (!bn) period = hour < 12 ? "AM" : "PM";
    else period = bnDayPeriod(hour, minute);
  }
  return { time: bn ? toBengaliDigits(time) : time, period, periodFirst: bn };
}

/** The parts as one string: "5:55 PM", "রাত ১২:০৫", "১৭:৫৫". */
export function joinClockParts({ time, period, periodFirst }: ClockParts): string {
  if (!period) return time;
  return periodFirst ? `${period} ${time}` : `${time} ${period}`;
}

/** "HH:mm" (optionally followed by anything, e.g. " (+06)") in the user's clock format; unparsable input is returned as is. */
export function formatHHMM(hhmm: string, locale: string, format: ClockFormat = DEFAULT_CLOCK_FORMAT): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  return joinClockParts(clockParts(Number(m[1]) % 24, Number(m[2]), locale, format));
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();
/** Hour (0-23) and minute of `at` on the wall clock of `timeZone`. */
export function wallClock(at: Date, timeZone: string): { hour: number; minute: number } {
  let f = zoneFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    zoneFormats.set(timeZone, f);
  }
  const parts = f.formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/**
 * A date and time for display ("12 Feb 2027 · 5:55 PM", bn "১২ ফেব, ২০২৭ · ৫:৫৫"), the time in the user's clock
 * format (no seconds) and the device's time zone unless one is given. For timestamps (last sync, announcements).
 */
export function formatDateTime(at: Date, locale: string, format: ClockFormat = DEFAULT_CLOCK_FORMAT, timeZone?: string): string {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tag = isBn(locale) ? "bn-BD-u-nu-beng" : "en-GB";
  const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: zone }).format(at);
  const { hour, minute } = wallClock(at, zone);
  return `${date} · ${joinClockParts(clockParts(hour, minute, locale, format))}`;
}
