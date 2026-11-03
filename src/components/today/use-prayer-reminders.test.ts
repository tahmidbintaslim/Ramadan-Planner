import { describe, expect, it } from "vitest";
import type { ReminderRuleDTO } from "@/actions/planner";
import { DEFAULT_PRAYER_REMINDER, reminderToggleChange, remindersByPrayer } from "./use-prayer-reminders";

const rule = (over: Partial<ReminderRuleDTO>): ReminderRuleDTO => ({
  id: "r1",
  type: "fajr",
  label: "",
  offsetMinutes: -10,
  channels: ["push", "calendar"],
  enabled: true,
  ...over,
});

describe("remindersByPrayer", () => {
  it("marks prayers with at least one enabled rule", () => {
    const rules = [rule({}), rule({ id: "r2", type: "asr", enabled: false }), rule({ id: "r3", type: "sehri" })];
    expect(remindersByPrayer(rules)).toEqual({ fajr: true, dhuhr: false, asr: false, maghrib: false, isha: false });
  });
});

describe("reminderToggleChange", () => {
  it("creates a default rule (15 min before, push) when the prayer has none", () => {
    expect(reminderToggleChange([], "dhuhr", true)).toEqual({
      kind: "create",
      rule: { type: "dhuhr", label: "", ...DEFAULT_PRAYER_REMINDER, enabled: true },
    });
    expect(DEFAULT_PRAYER_REMINDER).toEqual({ offsetMinutes: -15, channels: ["push"] });
  });

  it("re-enables the first existing rule, keeping its offset and channels", () => {
    const off = rule({ enabled: false });
    expect(reminderToggleChange([off], "fajr", true)).toEqual({ kind: "update", rules: [{ ...off, enabled: true }] });
  });

  it("disables every enabled rule of the prayer and leaves others alone", () => {
    const rules = [rule({}), rule({ id: "r2" }), rule({ id: "r3", type: "isha" })];
    const change = reminderToggleChange(rules, "fajr", false);
    expect(change).toEqual({
      kind: "update",
      rules: [
        { ...rules[0], enabled: false },
        { ...rules[1], enabled: false },
      ],
    });
  });

  it("does nothing when the state already matches", () => {
    expect(reminderToggleChange([rule({})], "fajr", true)).toEqual({ kind: "none" });
    expect(reminderToggleChange([], "fajr", false)).toEqual({ kind: "none" });
  });
});
