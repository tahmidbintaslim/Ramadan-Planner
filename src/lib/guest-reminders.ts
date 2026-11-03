import { useSyncExternalStore } from "react";
import type { ReminderRuleDTO } from "@/actions/planner-schemas";
import { pruneLocalHistory } from "@/lib/local-history";

/**
 * Guest reminder rules live under one stable key (localStorage `rp_reminder_rules`). They used to be stored under a
 * date-scoped key (`rp_reminder_rules_<UTC date>`), so a guest's reminders vanished the next day; the first read
 * migrates the most recent non-empty dated list.
 */
export const GUEST_REMINDER_RULES_KEY = "reminder_rules";
const STORAGE_KEY = `rp_${GUEST_REMINDER_RULES_KEY}`;
const DATED_KEY = /^rp_reminder_rules_(\d{4}-\d{2}-\d{2})$/;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** One-time migration from the dated keys. Returns true when it copied a non-empty list. Never throws. */
export function migrateGuestReminderRules(storage: StorageLike | undefined = globalThis.localStorage): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(STORAGE_KEY) !== null) return false;
    const dated: { key: string; date: string }[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      const m = key ? DATED_KEY.exec(key) : null;
      if (key && m) dated.push({ key, date: m[1] });
    }
    if (dated.length === 0) return false;
    dated.sort((a, b) => b.date.localeCompare(a.date));
    // The newest NON-EMPTY list: the old date-scoped hook wrote [] to each new day's key on first visit, so an
    // empty newest list usually means "a new day", not "the user cleared their reminders". The dated keys are
    // left alone (pruneLocalHistory expires them), so nothing is lost if this guess is wrong.
    let sawList = false;
    for (const { key } of dated) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(storage.getItem(key) ?? "null");
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      sawList = true;
      if (parsed.length === 0) continue;
      storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      return true;
    }
    if (sawList) storage.setItem(STORAGE_KEY, "[]");
    return false;
  } catch {
    return false;
  }
}

// ── Shared store: every reader (Reminders page, Home bells, daily tracker) sees each write at once ──

const CHANGE_EVENT = "rp:guest-reminder-rules";
const EMPTY: ReminderRuleDTO[] = [];
let migrated = false;
/** Used when localStorage is unavailable (private mode, blocked): rules last for this page session. */
let memoryRaw: string | null = null;
let cache: { raw: string | null; rules: ReminderRuleDTO[] } = { raw: null, rules: EMPTY };

function readRaw(): string | null {
  try {
    if (!migrated) {
      migrated = true;
      migrateGuestReminderRules();
      // The old dated lists stay for a week (in case the migration guessed wrong), then expire.
      pruneLocalHistory(STORAGE_KEY, 7);
    }
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function parseRules(raw: string | null): ReminderRuleDTO[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReminderRuleDTO[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** The current rules; the same array is returned until the stored value changes (a stable store snapshot). */
export function readGuestReminderRules(): ReminderRuleDTO[] {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, rules: parseRules(raw) };
  return cache.rules;
}

export function writeGuestReminderRules(
  updater: ReminderRuleDTO[] | ((prev: ReminderRuleDTO[]) => ReminderRuleDTO[]),
): void {
  const next = typeof updater === "function" ? updater(readGuestReminderRules()) : updater;
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    memoryRaw = raw;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Guest reminder rules (stable key, migrated on first read), as a shared external store. The server and the
 * hydrating render see an empty list, so they match; stored rules appear right after hydration.
 */
export function useGuestReminderRules(): {
  data: ReminderRuleDTO[];
  updateData: typeof writeGuestReminderRules;
} {
  const data = useSyncExternalStore(subscribe, readGuestReminderRules, () => EMPTY);
  return { data, updateData: writeGuestReminderRules };
}

/** Test hook: forget the module state. */
export function resetGuestReminderStoreForTests() {
  migrated = false;
  memoryRaw = null;
  cache = { raw: null, rules: EMPTY };
}
