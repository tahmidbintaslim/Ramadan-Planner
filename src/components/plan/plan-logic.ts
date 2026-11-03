// Pure helpers for the Day plan and the Last ten nights view (design system v2, Task 9).
// No React and no clock access: `now` and stored values are always parameters.
import type { TimetableDay } from "@/lib/ramadan-timetable";
import { ODD_NIGHTS } from "@/lib/ramadan-nights";
import { toBengaliDigits, zonedTime } from "@/lib/prayer-phase";
import { ddmmyyyyToISO } from "@/components/timetable/timetable-logic";

// ── Time windows ──────────────────────────────────────

/** The three checklist groups of the day plan, in display order. */
export const PLAN_WINDOWS = ["sehriToDhuhr", "dhuhrToIftar", "afterIftar"] as const;
export type PlanWindow = (typeof PLAN_WINDOWS)[number];

export function isPlanWindow(v: unknown): v is PlanWindow {
  return typeof v === "string" && (PLAN_WINDOWS as readonly string[]).includes(v);
}

// The plan tasks and goals have no time-window field (and the database is not changed for it), so the window is
// chosen when an item is added (kept per device, see plan-item-meta.ts) and otherwise guessed from the title.
const MORNING = /সেহরি|সাহরি|নিয়ত|নিয়্যত|ফজর|সকাল|ইশরাক|দুহা|চাশত|sehri|suhoor|suhur|niyyah|intention|fajr|morning|ishraq|duha/i;
const AFTER_IFTAR = /ইফতারের পর|মাগরিব|এশা|ইশা|তারাবি|তারাবীহ|তাহাজ্জুদ|বিতর|ঘুম|রাত|কদর|after iftar|maghrib|isha|tarawee?h|tarawih|tahajjud|witr|sleep|bed|night|qadr/i;

/** Best guess of a window from an item title (morning words, then evening words; otherwise the afternoon). */
export function windowFromTitle(title: string): PlanWindow {
  if (MORNING.test(title)) return "sehriToDhuhr";
  if (AFTER_IFTAR.test(title)) return "afterIftar";
  return "dhuhrToIftar";
}

export interface PlanItem {
  id: string;
  kind: "task" | "goal";
  title: string;
  done: boolean;
  window: PlanWindow;
  /** Default-template key (e.g. "sehri", "night:tahajjud") when the item came from a suggestion. */
  key?: string;
  /** Secondary line (time, duration, target, source). */
  meta?: string;
}

/** Items by window, keeping their order inside each window. Every window is present (possibly empty). */
export function groupByWindow<T extends { window: PlanWindow }>(items: readonly T[]): Record<PlanWindow, T[]> {
  const out = { sehriToDhuhr: [], dhuhrToIftar: [], afterIftar: [] } as Record<PlanWindow, T[]>;
  for (const item of items) out[item.window].push(item);
  return out;
}

// ── Default (suggested) items ─────────────────────────

export interface DefaultItem {
  key: string;
  window: PlanWindow;
}

/** The suggested day plan (Figma "Day plan · Roza 12"). Titles are `plan.items.<key>`. */
export const DAY_DEFAULTS: readonly DefaultItem[] = [
  { key: "sehri", window: "sehriToDhuhr" },
  { key: "fajr", window: "sehriToDhuhr" },
  { key: "morningDhikr", window: "sehriToDhuhr" },
  { key: "quran", window: "dhuhrToIftar" },
  { key: "charity", window: "dhuhrToIftar" },
  { key: "taraweeh", window: "afterIftar" },
  { key: "sleepDhikr", window: "afterIftar" },
];

/** Tonight's practices in the last ten nights. Titles are `plan.items.<key without "night:">`. */
export const NIGHT_DEFAULTS: readonly DefaultItem[] = [
  { key: "night:ishaTaraweeh", window: "afterIftar" },
  { key: "night:nightQuran", window: "afterIftar" },
  { key: "night:tahajjud", window: "afterIftar" },
  { key: "night:qadrDua", window: "afterIftar" },
];

export const isNightKey = (key: string | undefined): boolean => Boolean(key?.startsWith("night:"));
/** The `plan.items.*` message key for a default key. */
export const itemMessageKey = (key: string): string => key.replace(/^night:/, "");

/**
 * The default key an item stands for: the remembered key, else a title equal to a default's title in any locale
 * (so a suggestion added on another device, or before a language switch, is still recognised).
 */
export function matchDefaultKey(
  title: string,
  remembered: string | undefined,
  titlesByKey: Readonly<Record<string, readonly string[]>>,
): string | undefined {
  if (remembered) return remembered;
  const t = title.trim();
  for (const [key, titles] of Object.entries(titlesByKey)) {
    if (titles.some((x) => x === t)) return key;
  }
  return undefined;
}

// ── Progress card ─────────────────────────────────────

export type ProgressCopy = "progressEmpty" | "progressStart" | "progressGoing" | "progressDone";

/** Encouraging headline by progress (never guilt: nothing done yet reads as a gentle start). */
export function progressCopy(done: number, total: number): ProgressCopy {
  if (total <= 0) return "progressEmpty";
  if (done <= 0) return "progressStart";
  if (done >= total) return "progressDone";
  return "progressGoing";
}

const BN_TO_ASCII: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

/** The para (1-30) from the Quran tracker's free-text "para" field ("12", "১২", "12th"), or null. */
export function paraFromText(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const ascii = raw.replace(/[০-৯]/g, (d) => BN_TO_ASCII[d]);
  const m = /\d+/.exec(ascii);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 30 ? n : null;
}

function prevISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Consecutive days with a Quran entry, counting back from today (or from yesterday while today is still empty,
 * so the streak does not read as broken in the morning). `hasEntry` gets YYYY-MM-DD dates.
 */
export function quranStreak(todayISO: string, hasEntry: (iso: string) => boolean, maxDays = 30): number {
  let day = hasEntry(todayISO) ? todayISO : prevISO(todayISO);
  let n = 0;
  while (n < maxDays && hasEntry(day)) {
    n += 1;
    day = prevISO(day);
  }
  return n;
}

// ── Last ten nights ───────────────────────────────────

/**
 * Whether the last-ten-nights view is offered: from the maghrib of roza 20 (when the 21st night begins) through
 * the maghrib of roza 30 (Eid night). Outside Ramadan (`ramadanDay` null) never. Without a known maghrib on roza
 * 20 it waits for roza 21.
 */
export function lastTenVisible(ramadanDay: number | null, now: Date, maghribToday: Date | null): boolean {
  if (ramadanDay === null || !Number.isInteger(ramadanDay) || ramadanDay < 20 || ramadanDay > 30) return false;
  const afterMaghrib = maghribToday !== null && now.getTime() >= maghribToday.getTime();
  // The iftar of roza 30 ends Ramadan: the night after it is Eid night.
  if (ramadanDay === 30) return !afterMaghrib;
  if (ramadanDay >= 21) return true;
  return afterMaghrib;
}

/**
 * The night that is current or next on roza `ramadanDay`: before fajr it is the night that began yesterday
 * (night N = after the iftar of roza N-1); from fajr on it is the night that begins at this evening's maghrib.
 */
export function currentNight(ramadanDay: number, now: Date, fajrToday: Date | null): number {
  if (fajrToday && now.getTime() < fajrToday.getTime()) return ramadanDay;
  return ramadanDay + 1;
}

/** Night view by default at night (from maghrib, or before fajr), the day plan during the day. */
export function defaultPlanView(
  visible: boolean,
  now: Date,
  fajrToday: Date | null,
  maghribToday: Date | null,
): "day" | "nights" {
  if (!visible) return "day";
  const n = now.getTime();
  if (maghribToday && n >= maghribToday.getTime()) return "nights";
  if (fajrToday && n < fajrToday.getTime()) return "nights";
  return "day";
}

export type NightState = "past" | "tonight" | "upcoming";

export interface OddNightRow {
  night: number;
  state: NightState;
  /** Roza whose iftar begins the night (night - 1): its date and iftar time. */
  evening?: TimetableDay;
  /** Roza that the night's sehri belongs to (night). */
  morning?: TimetableDay;
}

/** The five odd nights (21-29), each tied to the evening of roza 20/22/24/26/28 (see oddNightStartingAfter). */
export function oddNightRows(days: readonly TimetableDay[], night: number): OddNightRow[] {
  return ODD_NIGHTS.map((n) => ({
    night: n,
    state: n < night ? "past" : n === night ? "tonight" : "upcoming",
    evening: days.find((d) => d.day === n - 1),
    morning: days.find((d) => d.day === n),
  }));
}

/** The instant a timetable row's HH:MM falls on, in `timeZone`. */
export function rowInstant(day: TimetableDay | undefined, hhmm: keyof Pick<TimetableDay, "sehri" | "fajr" | "maghrib" | "iftar">, timeZone: string): Date | null {
  if (!day) return null;
  return zonedTime(ddmmyyyyToISO(day.gregorianDate), day[hhmm], timeZone);
}

/** Suggested tahajjud: the start of the last third of the night (maghrib to the next fajr). */
export function tahajjudTime(maghrib: Date, nextFajr: Date): Date | null {
  const span = nextFajr.getTime() - maghrib.getTime();
  if (!(span > 0)) return null;
  return new Date(maghrib.getTime() + Math.round((span * 2) / 3 / 60_000) * 60_000);
}

export interface NightTimes {
  maghrib: Date;
  fajr: Date;
  sehriEnd: Date;
  tahajjud: Date;
}

/** Maghrib, next fajr, sehri end and suggested tahajjud for night `night`, or null without both rows. */
export function nightTimes(days: readonly TimetableDay[], night: number, timeZone: string): NightTimes | null {
  const evening = days.find((d) => d.day === night - 1);
  const morning = days.find((d) => d.day === night);
  const maghrib = rowInstant(evening, "maghrib", timeZone);
  const fajr = rowInstant(morning, "fajr", timeZone);
  const sehriEnd = rowInstant(morning, "sehri", timeZone) ?? fajr;
  if (!maghrib || !fajr || !sehriEnd) return null;
  const tahajjud = tahajjudTime(maghrib, fajr);
  return tahajjud ? { maghrib, fajr, sehriEnd, tahajjud } : null;
}

/** Elapsed fraction of the night (0 before maghrib, 1 at fajr). */
export function nightProgress(now: Date, t: Pick<NightTimes, "maghrib" | "fajr">): number {
  const span = t.fajr.getTime() - t.maghrib.getTime();
  if (!(span > 0)) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - t.maghrib.getTime()) / span));
}

// ── Display helpers ───────────────────────────────────

const BN_ORDINAL_SUFFIX: Record<number, string> = { 1: "ম", 2: "য়", 3: "য়", 4: "র্থ", 6: "ষ্ঠ" };

/** Bengali ordinal with Bengali digits: ১ম, ২য়, ৩য়, ৪র্থ, ৫ম, ৬ষ্ঠ, ... ১০ম, ১১তম, ... ৩০তম. */
export function bnOrdinal(n: number): string {
  const suffix = BN_ORDINAL_SUFFIX[n] ?? (n <= 10 ? "ম" : "তম");
  return `${toBengaliDigits(n)}${suffix}`;
}

/** The para to read next: one after the last read (capped at 30), or the first. */
export function nextPara(lastPara: number | null): number {
  return lastPara === null ? 1 : Math.min(30, lastPara + 1);
}
