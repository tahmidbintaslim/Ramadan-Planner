import { useState } from "react";
import type { ReminderRuleDTO } from "@/actions/planner-schemas";
import { useGuestData } from "@/hooks/use-guest-data";

/**
 * Guest reminder rules live under one stable key (localStorage `rp_reminder_rules`). They used to be stored under a
 * date-scoped key (`rp_reminder_rules_<UTC date>`), so a guest's reminders vanished the next day; the first read
 * migrates the most recent dated list.
 */
export const GUEST_REMINDER_RULES_KEY = "reminder_rules";
const STORAGE_KEY = `rp_${GUEST_REMINDER_RULES_KEY}`;
const DATED_KEY = /^rp_reminder_rules_(\d{4}-\d{2}-\d{2})$/;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** One-time migration from the dated keys. Returns true when it copied a list. Never throws. */
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
    // The newest list that parses as an array (an empty list on the latest day still counts: the user cleared it).
    for (const { key } of dated) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(storage.getItem(key) ?? "null");
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      dated.forEach((d) => storage.removeItem(d.key));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Guest reminder rules (stable key, migrated on first use). Shared by the Reminders page, Home bells and tracker. */
export function useGuestReminderRules() {
  // Runs before useGuestData reads storage on the first render.
  useState(() => {
    if (typeof window !== "undefined") migrateGuestReminderRules();
    return true;
  });
  return useGuestData<ReminderRuleDTO[]>(GUEST_REMINDER_RULES_KEY, []);
}
