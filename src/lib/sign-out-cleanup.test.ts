import { describe, expect, it } from "vitest";
import { personalStorageKeys } from "./sign-out-cleanup";

describe("personalStorageKeys", () => {
  it("removes notes, trackers, reminders and donor ids but keeps device settings", () => {
    const keys = ["rp_location", "rp_clock_format", "rp_known_timings", "rp_salah_2027-02-10", "rp_quran_last_read_v1",
      "rp_reminder_rules", "rp_donation_monthly_session", "rp_plan_goals", "theme", "other"];
    expect(personalStorageKeys(keys)).toEqual(["rp_salah_2027-02-10", "rp_quran_last_read_v1", "rp_reminder_rules",
      "rp_donation_monthly_session", "rp_plan_goals"]);
  });
});
