import { describe, expect, it } from "vitest";
import { migrateGuestReminderRules } from "./guest-reminders";

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

const rule = (type: string) => ({ id: type, type, label: "", offsetMinutes: -15, channels: ["push"], enabled: true });

describe("migrateGuestReminderRules", () => {
  it("copies the most recent dated list to the stable key and removes the dated keys", () => {
    const s = memoryStorage({
      "rp_reminder_rules_2027-02-18": JSON.stringify([rule("fajr")]),
      "rp_reminder_rules_2027-02-20": JSON.stringify([rule("isha"), rule("asr")]),
      "rp_reminder_rules_2027-02-19": JSON.stringify([rule("dhuhr")]),
      "rp_checklist_2027-02-20": "{}",
    });
    expect(migrateGuestReminderRules(s)).toBe(true);
    expect(JSON.parse(s.getItem("rp_reminder_rules")!)).toEqual([rule("isha"), rule("asr")]);
    expect(Array.from(s.map.keys()).sort()).toEqual(["rp_checklist_2027-02-20", "rp_reminder_rules"]);
  });

  it("skips an unreadable newest list and uses the next one", () => {
    const s = memoryStorage({
      "rp_reminder_rules_2027-02-20": "{broken",
      "rp_reminder_rules_2027-02-19": JSON.stringify([rule("dhuhr")]),
    });
    expect(migrateGuestReminderRules(s)).toBe(true);
    expect(JSON.parse(s.getItem("rp_reminder_rules")!)).toEqual([rule("dhuhr")]);
  });

  it("keeps an empty newest list (the user cleared their reminders)", () => {
    const s = memoryStorage({
      "rp_reminder_rules_2027-02-20": "[]",
      "rp_reminder_rules_2027-02-19": JSON.stringify([rule("dhuhr")]),
    });
    migrateGuestReminderRules(s);
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
    const throwing = { ...memoryStorage(), getItem: () => { throw new Error("denied"); } };
    expect(migrateGuestReminderRules(throwing)).toBe(false);
  });
});
