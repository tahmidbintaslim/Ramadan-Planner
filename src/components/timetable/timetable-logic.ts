// Pure helpers for the Ramadan timetable screen: row states, decades, the date range and display formats.
// Input is the TimetableDay[] from src/lib/ramadan-timetable.ts (gregorianDate is DD-MM-YYYY, times HH:MM 24h).
import type { TimetableDay } from "@/lib/ramadan-timetable";
import { toBengaliDigits } from "@/lib/prayer-phase";

export type Locale = "bn" | "en";

/** Nights the Prophet (peace be upon him) told us to seek Laylat al-Qadr in. */
export const ODD_NIGHTS: readonly number[] = [21, 23, 25, 27, 29];

export const DECADES = [
  { id: "rahmat", from: 1, to: 10 },
  { id: "maghfirah", from: 11, to: 20 },
  { id: "najat", from: 21, to: 30 },
] as const;

export type DecadeId = (typeof DECADES)[number]["id"];
export type RowState = "past" | "today" | "upcoming";

export function isOddNight(day: number): boolean {
  return ODD_NIGHTS.includes(day);
}

/** 0, 1 or 2 for Ramadan day 1-10, 11-20, 21-30. */
export function decadeIndex(day: number): 0 | 1 | 2 {
  return day <= 10 ? 0 : day <= 20 ? 1 : 2;
}

export function decadeDays(days: readonly TimetableDay[], index: number): TimetableDay[] {
  const d = DECADES[index];
  return days.filter((x) => x.day >= d.from && x.day <= d.to);
}

/** DD-MM-YYYY to YYYY-MM-DD (sorts and compares as text). */
export function ddmmyyyyToISO(s: string): string {
  const [dd, mm, yyyy] = s.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

/** Past rows are before today, the today row matches the calendar date in the timetable's time zone. */
export function rowState(day: TimetableDay, todayISO: string): RowState {
  const iso = ddmmyyyyToISO(day.gregorianDate);
  return iso < todayISO ? "past" : iso === todayISO ? "today" : "upcoming";
}

/** The decade containing today during Ramadan, otherwise the first. */
export function defaultDecade(days: readonly TimetableDay[], todayISO: string): 0 | 1 | 2 {
  if (days.length === 0) return 0;
  const first = ddmmyyyyToISO(days[0].gregorianDate);
  const last = ddmmyyyyToISO(days[days.length - 1].gregorianDate);
  if (todayISO < first || todayISO > last) return 0;
  const hit = days.find((d) => ddmmyyyyToISO(d.gregorianDate) === todayISO);
  if (hit) return decadeIndex(hit.day);
  // A gap in the data: use the next listed day.
  const next = days.find((d) => ddmmyyyyToISO(d.gregorianDate) > todayISO);
  return next ? decadeIndex(next.day) : 0;
}

export function isRamadanNow(days: readonly TimetableDay[], todayISO: string): boolean {
  if (days.length === 0) return false;
  return (
    todayISO >= ddmmyyyyToISO(days[0].gregorianDate) &&
    todayISO <= ddmmyyyyToISO(days[days.length - 1].gregorianDate)
  );
}

export function dateRange(days: readonly TimetableDay[]): { start: string; end: string } | null {
  if (days.length === 0) return null;
  return {
    start: ddmmyyyyToISO(days[0].gregorianDate),
    end: ddmmyyyyToISO(days[days.length - 1].gregorianDate),
  };
}

// ── Formatting ────────────────────────────────────────

const MONTHS: Record<Locale, readonly string[]> = {
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export function digits(s: string | number, locale: Locale): string {
  return locale === "bn" ? toBengaliDigits(s) : String(s);
}

/** "9 February" / "৯ ফেব্রুয়ারি" from YYYY-MM-DD. */
export function formatDayMonth(iso: string, locale: Locale): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${digits(d, locale)} ${MONTHS[locale][m - 1]}`;
}

/** "9 February – 10 March 2027" / "৯ ফেব্রুয়ারি – ১০ মার্চ ২০২৭". */
export function formatRange(range: { start: string; end: string }, locale: Locale): string {
  const year = range.end.slice(0, 4);
  const startYear = range.start.slice(0, 4);
  const start = startYear === year ? formatDayMonth(range.start, locale) : `${formatDayMonth(range.start, locale)} ${digits(startYear, locale)}`;
  return `${start} – ${formatDayMonth(range.end, locale)} ${digits(year, locale)}`;
}

/** "17:55" to "5:55" (12-hour, no am/pm, like the home screen), with locale digits. */
export function formatClock(hhmm: string, locale: Locale): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]) % 12 || 12;
  return digits(`${h}:${m[2]}`, locale);
}

/** Weekday and day-month for a row, e.g. "সোম · ৯ ফেব্রুয়ারি". */
export function formatRowDate(day: TimetableDay, weekdayLabel: string, locale: Locale): string {
  return `${weekdayLabel} · ${formatDayMonth(ddmmyyyyToISO(day.gregorianDate), locale)}`;
}
