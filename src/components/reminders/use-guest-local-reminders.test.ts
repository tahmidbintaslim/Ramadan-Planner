import { describe, expect, it } from "vitest";
import type { ReminderRuleDTO } from "@/actions/planner";
import { upcomingGuestReminders } from "./use-guest-local-reminders";

const times = { sehri: "04:57", iftar: "17:58", fajr: "05:02", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12" };
const rule = (over: Partial<ReminderRuleDTO>): ReminderRuleDTO => ({
  id: "r", type: "iftar", label: "", offsetMinutes: -10, channels: ["push"], enabled: true, ...over,
});

describe("upcomingGuestReminders", () => {
  // 2027-02-20 13:00 in Dhaka (UTC+6) = 07:00 UTC.
  const now = new Date("2027-02-20T07:00:00Z");

  it("schedules today's later reminders at event time + offset in the place's zone", () => {
    const out = upcomingGuestReminders([rule({})], times, "2027-02-20", "Asia/Dhaka", now);
    expect(out.map((o) => o.at.toISOString())).toEqual(["2027-02-20T11:48:00.000Z"]); // 17:48 Dhaka
  });

  it("skips past, disabled, non-notification and unknown-time rules", () => {
    const out = upcomingGuestReminders(
      [
        rule({ id: "past", type: "fajr" }),
        rule({ id: "off", enabled: false }),
        rule({ id: "email", channels: ["email"] }),
        rule({ id: "custom", type: "custom" }),
        rule({ id: "isha", type: "isha", offsetMinutes: 0 }),
      ],
      times,
      "2027-02-20",
      "Asia/Dhaka",
      now,
    );
    expect(out.map((o) => o.rule.id)).toEqual(["isha"]);
  });
});
