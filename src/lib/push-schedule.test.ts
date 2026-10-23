import { describe, expect, it } from "vitest";
import {
  DISPATCH_INTERVAL_MS,
  DUE_WINDOW_MS,
  applyOffset,
  baseTimeForRule,
  dueLocalDates,
  dueOccurrenceForRule,
  findDueOccurrence,
  hasBearerSecret,
  isDue,
  toAlAdhanDate,
} from "./push-schedule";

const MIN = 60 * 1000;

describe("due window", () => {
  it("covers at least one full dispatch interval", () => {
    expect(DUE_WINDOW_MS).toBeGreaterThanOrEqual(DISPATCH_INTERVAL_MS);
  });

  it("is due from the scheduled instant until the window closes", () => {
    const scheduledAt = new Date("2027-02-08T12:00:00Z");
    expect(isDue(scheduledAt, new Date("2027-02-08T11:59:59Z"))).toBe(false);
    expect(isDue(scheduledAt, scheduledAt)).toBe(true);
    expect(isDue(scheduledAt, new Date(scheduledAt.getTime() + DUE_WINDOW_MS - 1))).toBe(true);
    expect(isDue(scheduledAt, new Date(scheduledAt.getTime() + DUE_WINDOW_MS))).toBe(false);
  });

  it("sends every minute of the day from some 5-minute run", () => {
    // Runs at :00, :05, :10 ... UTC; every reminder minute must land in a window.
    const dayStart = Date.parse("2027-02-08T00:00:00Z");
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const scheduledAt = new Date(dayStart + minute * MIN);
      const nextRun = Math.ceil(scheduledAt.getTime() / DISPATCH_INTERVAL_MS) * DISPATCH_INTERVAL_MS;
      expect(isDue(scheduledAt, new Date(nextRun))).toBe(true);
    }
  });

  it("still sends when a run starts a few minutes late", () => {
    const scheduledAt = new Date("2027-02-08T12:01:00Z");
    // The 12:05 run was skipped; the 12:10 run starts 4 minutes late.
    expect(isDue(scheduledAt, new Date("2027-02-08T12:09:00Z"))).toBe(true);
  });
});

describe("findDueOccurrence", () => {
  it("resolves local HH:mm in the user's time zone", () => {
    // 18:00 in Dhaka (UTC+6) is 12:00 UTC.
    const due = findDueOccurrence("18:00", "Asia/Dhaka", new Date("2027-02-08T12:03:00Z"));
    expect(due?.toISOString()).toBe("2027-02-08T12:00:00.000Z");
  });

  it("returns null outside the window", () => {
    expect(findDueOccurrence("18:00", "Asia/Dhaka", new Date("2027-02-08T11:58:00Z"))).toBeNull();
    expect(findDueOccurrence("18:00", "Asia/Dhaka", new Date("2027-02-08T13:00:00Z"))).toBeNull();
  });

  it("sends a reminder set just before local midnight from a run just after it", () => {
    // 23:58 on Feb 8 in Dhaka is 17:58 UTC; the run at 18:00 UTC is 00:00 Feb 9 local.
    const due = findDueOccurrence("23:58", "Asia/Dhaka", new Date("2027-02-08T18:00:00Z"));
    expect(due?.toISOString()).toBe("2027-02-08T17:58:00.000Z");
  });

  it("is DST-aware", () => {
    // New York is UTC-5 in winter and UTC-4 in summer.
    expect(
      findDueOccurrence("05:00", "America/New_York", new Date("2027-01-15T10:01:00Z"))?.toISOString(),
    ).toBe("2027-01-15T10:00:00.000Z");
    expect(
      findDueOccurrence("05:00", "America/New_York", new Date("2027-07-15T09:01:00Z"))?.toISOString(),
    ).toBe("2027-07-15T09:00:00.000Z");
  });

  it("rejects malformed times", () => {
    expect(findDueOccurrence("25:00", "Asia/Dhaka", new Date())).toBeNull();
  });
});

describe("rule time helpers", () => {
  const times = {
    sehri: "04:50",
    iftar: "17:55",
    fajr: "04:55",
    dhuhr: "12:10",
    asr: "15:30",
    maghrib: "17:55",
    isha: "19:10",
  };

  it("maps rule types to base times", () => {
    expect(baseTimeForRule("sehri", times)).toBe("04:50");
    expect(baseTimeForRule("taraweeh", times)).toBe("19:10");
    expect(baseTimeForRule("tahajjud", times)).toBe("03:00");
    expect(baseTimeForRule("custom", times)).toBeNull();
  });

  it("applies offsets and wraps around midnight", () => {
    expect(applyOffset("04:50", -15)).toBe("04:35");
    expect(applyOffset("00:10", -20)).toBe("23:50");
    expect(applyOffset("23:50", 20)).toBe("00:10");
    expect(applyOffset("bad", 5)).toBeNull();
  });
});

describe("per-day prayer times", () => {
  const dayTimes = (isha: string) => ({
    sehri: "04:50",
    iftar: "17:55",
    fajr: "04:55",
    dhuhr: "12:10",
    asr: "15:30",
    maghrib: "17:55",
    isha,
  });

  it("formats dates for AlAdhan", () => {
    expect(toAlAdhanDate("2027-02-08")).toBe("08-02-2027");
  });

  it("checks the previous local date only just after local midnight", () => {
    // Dhaka is UTC+6: 18:03 UTC is 00:03 on Feb 9 local.
    expect(dueLocalDates("Asia/Dhaka", new Date("2027-02-08T18:03:00Z"))).toEqual([
      "2027-02-08",
      "2027-02-09",
    ]);
    expect(dueLocalDates("Asia/Dhaka", new Date("2027-02-08T12:00:00Z"))).toEqual([
      "2027-02-08",
    ]);
  });

  it("gives runs on both sides of midnight the same instant, so the second send is deduped", () => {
    // Isha + 30 min falls at 23:52 on Feb 8 local; Feb 9's Isha is a minute later.
    const rule = { type: "isha", offsetMinutes: 30 };
    const feb8 = { day: "2027-02-08", prayerTimes: dayTimes("23:22") };
    const feb9 = { day: "2027-02-09", prayerTimes: dayTimes("23:23") };

    // 23:55 local (17:55 UTC): only Feb 8 is a candidate date.
    const before = dueOccurrenceForRule(rule, [feb8], "Asia/Dhaka", new Date("2027-02-08T17:55:00Z"));
    // 00:00 local on Feb 9 (18:00 UTC): both dates are candidates.
    const after = dueOccurrenceForRule(rule, [feb8, feb9], "Asia/Dhaka", new Date("2027-02-08T18:00:00Z"));

    expect(before?.scheduledAt.toISOString()).toBe("2027-02-08T17:52:00.000Z");
    expect(after?.day).toBe("2027-02-08");
    expect(after?.scheduledAt.toISOString()).toBe(before?.scheduledAt.toISOString());
  });

  it("skips rules without a base time", () => {
    const days = [{ day: "2027-02-08", prayerTimes: dayTimes("19:10") }];
    expect(
      dueOccurrenceForRule({ type: "custom", offsetMinutes: 0 }, days, "Asia/Dhaka", new Date("2027-02-08T13:10:00Z")),
    ).toBeNull();
  });
});

describe("hasBearerSecret", () => {
  it("accepts only the exact bearer token", () => {
    expect(hasBearerSecret("Bearer s3cret", "s3cret")).toBe(true);
    expect(hasBearerSecret("Bearer wrong", "s3cret")).toBe(false);
    expect(hasBearerSecret("s3cret", "s3cret")).toBe(false);
    expect(hasBearerSecret(null, "s3cret")).toBe(false);
  });

  it("rejects everything when the secret is unset", () => {
    expect(hasBearerSecret("Bearer ", undefined)).toBe(false);
    expect(hasBearerSecret("Bearer ", "  ")).toBe(false);
  });
});
