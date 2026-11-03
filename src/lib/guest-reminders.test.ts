// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReminderRuleDTO } from "@/actions/planner-schemas";
import {
  migrateGuestReminderRules,
  readGuestReminderRules,
  resetGuestReminderStoreForTests,
  writeGuestReminderRules,
} from "./guest-reminders";

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const rule = (type: ReminderRuleDTO["type"]): ReminderRuleDTO => ({
  id: type,
  type,
  label: "",
  offsetMinutes: -15,
  channels: ["push"],
  enabled: true,
});

describe("migrateGuestReminderRules", () => {
  it("copies the newest non-empty dated list and keeps the dated keys (they expire on their own)", () => {
    const s = memoryStorage({
      "rp_reminder_rules_2027-02-18": JSON.stringify([rule("fajr")]),
      "rp_reminder_rules_2027-02-20": JSON.stringify([rule("isha"), rule("asr")]),
      "rp_reminder_rules_2027-02-19": JSON.stringify([rule("dhuhr")]),
      "rp_checklist_2027-02-20": "{}",
    });
    expect(migrateGuestReminderRules(s)).toBe(true);
    expect(JSON.parse(s.getItem("rp_reminder_rules")!)).toEqual([rule("isha"), rule("asr")]);
    expect(s.map.size).toBe(5);
  });

  it("skips the empty list the old hook wrote on a new day (02-18 set, 02-19 empty)", () => {
    const s = memoryStorage({
      "rp_reminder_rules_2027-02-18": JSON.stringify([rule("fajr"), rule("isha")]),
      "rp_reminder_rules_2027-02-19": "[]",
    });
    expect(migrateGuestReminderRules(s)).toBe(true);
    expect(JSON.parse(s.getItem("rp_reminder_rules")!)).toEqual([rule("fajr"), rule("isha")]);
    expect(s.getItem("rp_reminder_rules_2027-02-19")).toBe("[]");
  });

  it("skips an unreadable list and uses the next one", () => {
    const s = memoryStorage({
      "rp_reminder_rules_2027-02-20": "{broken",
      "rp_reminder_rules_2027-02-19": JSON.stringify([rule("dhuhr")]),
    });
    expect(migrateGuestReminderRules(s)).toBe(true);
    expect(JSON.parse(s.getItem("rp_reminder_rules")!)).toEqual([rule("dhuhr")]);
  });

  it("falls back to an empty list only when every dated list is empty", () => {
    const s = memoryStorage({ "rp_reminder_rules_2027-02-20": "[]", "rp_reminder_rules_2027-02-19": "[]" });
    expect(migrateGuestReminderRules(s)).toBe(false);
    expect(s.getItem("rp_reminder_rules")).toBe("[]");
  });

  it("runs only once: an existing stable list is never overwritten", () => {
    const s = memoryStorage({
      rp_reminder_rules: JSON.stringify([rule("fajr")]),
      "rp_reminder_rules_2027-02-20": JSON.stringify([rule("isha")]),
    });
    expect(migrateGuestReminderRules(s)).toBe(false);
    expect(JSON.parse(s.getItem("rp_reminder_rules")!)).toEqual([rule("fajr")]);
  });

  it("does nothing without dated keys or storage, and never throws", () => {
    const s = memoryStorage();
    expect(migrateGuestReminderRules(s)).toBe(false);
    expect(s.getItem("rp_reminder_rules")).toBeNull();
    expect(migrateGuestReminderRules(undefined)).toBe(false);
    const throwing = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error("denied");
      },
    };
    expect(migrateGuestReminderRules(throwing)).toBe(false);
  });
});

describe("guest reminder store", () => {
  afterEach(() => {
    localStorage.clear();
    resetGuestReminderStoreForTests();
    vi.restoreAllMocks();
  });

  it("migrates on first read, returns a stable snapshot and notifies on write", () => {
    localStorage.setItem("rp_reminder_rules_2027-02-18", JSON.stringify([rule("fajr")]));
    const first = readGuestReminderRules();
    expect(first).toEqual([rule("fajr")]);
    expect(readGuestReminderRules()).toBe(first);
    const onChange = vi.fn();
    window.addEventListener("rp:guest-reminder-rules", onChange);
    writeGuestReminderRules((prev) => [...prev, rule("isha")]);
    window.removeEventListener("rp:guest-reminder-rules", onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(readGuestReminderRules()).toEqual([rule("fajr"), rule("isha")]);
    expect(JSON.parse(localStorage.getItem("rp_reminder_rules")!)).toHaveLength(2);
  });

  it("keeps rules in memory when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readGuestReminderRules()).toEqual([]);
    writeGuestReminderRules([rule("asr")]);
    expect(readGuestReminderRules()).toEqual([rule("asr")]);
  });
});
