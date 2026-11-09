import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prisma is mocked (no database): each test queues the model method results it needs and checks the calls.
const m = vi.hoisted(() => ({
  prisma: {
    dailyLog: { findUnique: vi.fn(), upsert: vi.fn() },
    prayerGoal: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    planTask: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    reminderRule: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    userProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));

import { clerkIdToUuid } from "@/lib/auth/uuid";
import {
  createPlanTaskImpl,
  createPrayerGoalImpl,
  createReminderRuleImpl,
  deletePlanTaskImpl,
  deletePrayerGoalImpl,
  deleteReminderRuleImpl,
  getDailyLogImpl,
  getUserProfileImpl,
  listPlanTasksImpl,
  listPrayerGoalsImpl,
  listReminderRulesImpl,
  saveDailyLogImpl,
  updatePlanTaskImpl,
  updatePrayerGoalImpl,
  updateReminderRuleImpl,
  updateUserProfileImpl,
} from "./planner-impl";

// Real Clerk-derived ids (the auth middleware passes clerkIdToUuid(clerkUserId)): the mapping is unchanged.
const USER = clerkIdToUuid("user_alice");
const OTHER = clerkIdToUuid("user_bob");
const ID = "11111111-1111-4111-8111-111111111111";
const DB_ERROR = new Error("boom");

type Fn = ReturnType<typeof vi.fn>;
const allCalls = () =>
  Object.entries(m.prisma).flatMap(([model, fns]) =>
    Object.entries(fns as Record<string, Fn>).flatMap(([name, fn]) =>
      fn.mock.calls.map((call) => ({ model, name, args: call[0] as Record<string, unknown> })),
    ),
  );

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const model of Object.values(m.prisma)) for (const fn of Object.values(model as Record<string, Fn>)) fn.mockReset();
});

/**
 * Data isolation: every Prisma call is keyed by USER (user_profiles by its primary key `id`, daily logs by the
 * (user, ramadan year, day) key, everything else by `userId`), every create carries USER, and nothing names OTHER.
 */
afterEach(() => {
  for (const { model, name, args } of allCalls()) {
    const where = args.where as Record<string, unknown> | undefined;
    if (model === "userProfile") {
      expect(where?.id, `${model}.${name} where.id`).toBe(USER);
    } else if (model === "dailyLog") {
      const key = where?.userId_ramadanYear_day as Record<string, unknown> | undefined;
      expect(key?.userId, `${model}.${name} where key`).toBe(USER);
    } else if (where) {
      expect(where.userId, `${model}.${name} where.userId`).toBe(USER);
    }
    const create = (args.create ?? args.data) as Record<string, unknown> | undefined;
    if (name === "create" || name === "upsert") {
      expect(create?.[model === "userProfile" ? "id" : "userId"], `${model}.${name} owner`).toBe(USER);
    }
    expect(JSON.stringify(args)).not.toContain(OTHER);
  }
  vi.restoreAllMocks();
});

describe("daily logs", () => {
  const row = {
    id: "log-1",
    day: 3,
    prayers: { fajr: true },
    quranPara: 2,
    quranSurah: "Al-Baqarah",
    quranAyah: 10,
    quranPages: 0,
    checklist: ["a", 5],
    journalText: "r",
    myDua: "d",
    dayTaskDone: true,
  };
  const dto = {
    id: "log-1",
    day: 3,
    prayers: { fajr: true },
    quran: { para: "2", surah: "Al-Baqarah", ayah: "10", pages: "" },
    checklist: ["a"],
    journal: { reflection: "r", myDua: "d" },
    dayTaskDone: true,
  };

  it("getDailyLog: the user's row for this Ramadan (Hijri year of the client's local date)", async () => {
    m.prisma.dailyLog.findUnique.mockResolvedValue(row);
    await expect(getDailyLogImpl(USER, 3, "2027-02-20")).resolves.toEqual({ ok: true, data: dto });
    expect(m.prisma.dailyLog.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_ramadanYear_day: { userId: USER, ramadanYear: 1448, day: 3 } } }),
    );
    // A date in the next Ramadan reads that year's row, not this one.
    await getDailyLogImpl(USER, 3, "2028-02-10");
    expect(m.prisma.dailyLog.findUnique.mock.calls[1][0].where.userId_ramadanYear_day.ramadanYear).toBe(1449);
    expect(m.prisma.userProfile.findUnique).not.toHaveBeenCalled();
  });

  it("getDailyLog: without a date, uses today in the profile's time zone", async () => {
    vi.useFakeTimers();
    try {
      // 2026-03-01 20:30 UTC is already 2 March in Dhaka; both are in Ramadan 1447.
      vi.setSystemTime(new Date("2026-03-01T20:30:00Z"));
      m.prisma.userProfile.findUnique.mockResolvedValue({ timezone: "Asia/Dhaka" });
      m.prisma.dailyLog.findUnique.mockResolvedValue(null);
      await expect(getDailyLogImpl(USER, 12)).resolves.toEqual({ ok: true, data: null });
      expect(m.prisma.userProfile.findUnique).toHaveBeenCalledWith({ where: { id: USER }, select: { timezone: true } });
      expect(m.prisma.dailyLog.findUnique.mock.calls[0][0].where.userId_ramadanYear_day).toEqual({
        userId: USER,
        ramadanYear: 1447,
        day: 12,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("getDailyLog: invalid_day (and a bad date); load_failed", async () => {
    await expect(getDailyLogImpl(USER, 31)).resolves.toEqual({ ok: false, error: "invalid_day" });
    await expect(getDailyLogImpl(USER, 1.5)).resolves.toEqual({ ok: false, error: "invalid_day" });
    await expect(getDailyLogImpl(USER, 2, "02-03-2027")).resolves.toEqual({ ok: false, error: "invalid_day" });
    expect(allCalls()).toHaveLength(0); // the invalid calls never queried
    m.prisma.dailyLog.findUnique.mockRejectedValue(DB_ERROR);
    await expect(getDailyLogImpl(USER, 2, "2027-02-10")).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("saveDailyLog: an update writes only the fields it carries (concurrent saves cannot undo each other)", async () => {
    m.prisma.dailyLog.findUnique.mockResolvedValue({ logDate: new Date("2027-02-12T00:00:00.000Z") });
    m.prisma.dailyLog.upsert.mockResolvedValue({ ...row, prayers: { fajr: true, isha: true } });
    const result = await saveDailyLogImpl(USER, { day: 3, logDate: "2027-02-12", prayers: { fajr: true, isha: true } });
    expect(result).toEqual({ ok: true, data: { ...dto, prayers: { fajr: true, isha: true } } });
    const args = m.prisma.dailyLog.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_ramadanYear_day: { userId: USER, ramadanYear: 1448, day: 3 } });
    const logDate = new Date("2027-02-12T00:00:00.000Z");
    expect(args.update).toEqual({ prayers: { fajr: true, isha: true }, logDate });
    expect(args.create).toEqual({
      userId: USER, ramadanYear: 1448, day: 3, logDate, prayers: { fajr: true, isha: true },
      checklist: [], quranPara: 0, quranSurah: "", quranAyah: 0, quranPages: 0, journalText: "", myDua: "", dayTaskDone: false,
    });
  });

  it("saveDailyLog: outside Ramadan a row from another date starts empty (no old ticks, nothing carried into Ramadan)", async () => {
    // Nov 2026 is outside Ramadan: every day is day 1 of 1448, the same row as Ramadan 1448 day 1.
    m.prisma.dailyLog.findUnique.mockResolvedValue({ logDate: new Date("2026-11-08T00:00:00.000Z") });
    m.prisma.dailyLog.upsert.mockResolvedValue(row);
    await saveDailyLogImpl(USER, { day: 1, logDate: "2026-11-09", prayers: { fajr: true } });
    expect(m.prisma.dailyLog.upsert.mock.calls[0][0].update).toMatchObject({
      prayers: { fajr: true }, quranPara: 0, journalText: "", dayTaskDone: false, logDate: new Date("2026-11-09T00:00:00.000Z"),
    });
  });

  it("getDailyLog: a row stored on another date outside Ramadan is not today's; inside Ramadan it is kept", async () => {
    m.prisma.dailyLog.findUnique.mockResolvedValue({ ...row, logDate: new Date("2026-11-08T00:00:00.000Z") });
    await expect(getDailyLogImpl(USER, 1, "2026-11-09")).resolves.toEqual({ ok: true, data: null });
    // The pre-Ramadan row must not pre-fill Ramadan day 1.
    await expect(getDailyLogImpl(USER, 1, "2027-02-09")).resolves.toEqual({ ok: true, data: null });
    // Within Ramadan a slightly different date (a cached day number after midnight) keeps the row.
    m.prisma.dailyLog.findUnique.mockResolvedValue({ ...row, logDate: new Date("2027-02-19T00:00:00.000Z") });
    await expect(getDailyLogImpl(USER, 3, "2027-02-20")).resolves.toEqual({ ok: true, data: dto });
  });

  it("saveDailyLog: a new row parses the quran counts and trims the surah", async () => {
    m.prisma.dailyLog.findUnique.mockResolvedValue(null);
    m.prisma.dailyLog.upsert.mockResolvedValue(row);
    await saveDailyLogImpl(USER, {
      day: 5,
      logDate: "2027-02-14",
      quran: { para: "3", surah: " Yasin ", ayah: "x", pages: "-4" },
      journal: { reflection: "ok", myDua: "rabbi" },
    });
    expect(m.prisma.dailyLog.upsert.mock.calls[0][0].create).toMatchObject({
      userId: USER,
      day: 5,
      quranPara: 3,
      quranSurah: "Yasin",
      quranAyah: 0,
      quranPages: 0,
      prayers: {},
      checklist: [],
      journalText: "ok",
      myDua: "rabbi",
      dayTaskDone: false,
    });
  });

  it("saveDailyLog: input limits", async () => {
    const big = "x".repeat(5001);
    const bad = [
      { day: 0 },
      { day: 1, logDate: "12-02-2027" },
      { day: 1, prayers: { fajr: true, lunch: true } },
      { day: 1, checklist: Array.from({ length: 51 }, (_, i) => `k${i}`) },
      { day: 1, checklist: ["y".repeat(201)] },
      { day: 1, journal: { reflection: big, myDua: "" } },
      { day: 1, journal: { reflection: "", myDua: big } },
      { day: 1, quran: { para: "1", surah: "s".repeat(501), ayah: "", pages: "" } },
    ];
    for (const input of bad) {
      await expect(saveDailyLogImpl(USER, input as never), JSON.stringify(input).slice(0, 80)).resolves.toEqual({
        ok: false,
        error: "invalid_input",
      });
    }
    expect(allCalls()).toHaveLength(0);
    // The limits themselves are allowed (taraweeh/tahajjud are tracked too).
    m.prisma.dailyLog.findUnique.mockResolvedValue(null);
    m.prisma.dailyLog.upsert.mockResolvedValue(row);
    const ok = await saveDailyLogImpl(USER, {
      day: 1,
      logDate: "2027-02-08",
      prayers: { fajr: true, taraweeh: true, tahajjud: false },
      checklist: Array.from({ length: 50 }, () => "y".repeat(200)),
      journal: { reflection: "x".repeat(5000), myDua: "x".repeat(5000) },
    });
    expect(ok.ok).toBe(true);
  });

  it("saveDailyLog: save_failed when Prisma throws", async () => {
    m.prisma.dailyLog.findUnique.mockResolvedValue(null);
    m.prisma.dailyLog.upsert.mockRejectedValue(DB_ERROR);
    await expect(saveDailyLogImpl(USER, { day: 4, logDate: "2027-02-11" })).resolves.toEqual({
      ok: false,
      error: "save_failed",
    });
  });
});

describe("prayer goals", () => {
  const row = { id: ID, title: "Tahajjud", targetCount: 10, targetUnit: "nights", isCompleted: false, sortOrder: 2 };
  const dto = { id: ID, title: "Tahajjud", targetCount: 10, targetUnit: "nights", isCompleted: false, sortOrder: 2 };

  it("list: maps rows, ordered; load_failed on error", async () => {
    m.prisma.prayerGoal.findMany.mockResolvedValueOnce([row]);
    await expect(listPrayerGoalsImpl(USER)).resolves.toEqual({ ok: true, data: [dto] });
    expect(m.prisma.prayerGoal.findMany.mock.calls[0][0].orderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "asc" }]);
    m.prisma.prayerGoal.findMany.mockRejectedValueOnce(DB_ERROR);
    await expect(listPrayerGoalsImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("create: next sort order, creates with userId; invalid_input; save_failed", async () => {
    m.prisma.prayerGoal.findFirst.mockResolvedValueOnce({ sortOrder: 1 });
    m.prisma.prayerGoal.create.mockResolvedValueOnce(row);
    await expect(
      createPrayerGoalImpl(USER, { title: " Tahajjud ", targetCount: 10, targetUnit: "nights" }),
    ).resolves.toEqual({ ok: true, data: dto });
    expect(m.prisma.prayerGoal.create.mock.calls[0][0].data).toEqual({
      userId: USER,
      title: "Tahajjud",
      targetCount: 10,
      targetUnit: "nights",
      sortOrder: 2,
    });
    await expect(
      createPrayerGoalImpl(USER, { title: "", targetCount: 10, targetUnit: "nights" }),
    ).resolves.toEqual({ ok: false, error: "invalid_input" });
    m.prisma.prayerGoal.findFirst.mockResolvedValueOnce(null);
    m.prisma.prayerGoal.create.mockRejectedValueOnce(DB_ERROR);
    await expect(
      createPrayerGoalImpl(USER, { title: "x", targetCount: 1, targetUnit: "times" }),
    ).resolves.toEqual({ ok: false, error: "save_failed" });
    expect(m.prisma.prayerGoal.create.mock.calls[1][0].data).toMatchObject({ userId: USER, sortOrder: 0 });
  });

  it("update: keyed by id AND userId; invalid_input; save_failed", async () => {
    m.prisma.prayerGoal.update.mockResolvedValueOnce({ ...row, isCompleted: true });
    const input = { id: ID, title: "Tahajjud", targetCount: 10, targetUnit: "nights", isCompleted: true };
    await expect(updatePrayerGoalImpl(USER, input)).resolves.toEqual({ ok: true, data: { ...dto, isCompleted: true } });
    expect(m.prisma.prayerGoal.update.mock.calls[0][0].where).toEqual({ id: ID, userId: USER });
    await expect(updatePrayerGoalImpl(USER, { ...input, id: "nope" })).resolves.toEqual({ ok: false, error: "invalid_input" });
    m.prisma.prayerGoal.update.mockRejectedValueOnce(DB_ERROR); // e.g. P2025: not this user's goal
    await expect(updatePrayerGoalImpl(USER, input)).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("delete: keyed by id AND userId; invalid_input; delete_failed", async () => {
    m.prisma.prayerGoal.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(deletePrayerGoalImpl(USER, ID)).resolves.toEqual({ ok: true, data: null });
    expect(m.prisma.prayerGoal.deleteMany).toHaveBeenCalledWith({ where: { id: ID, userId: USER } });
    await expect(deletePrayerGoalImpl(USER, "nope")).resolves.toEqual({ ok: false, error: "invalid_input" });
    m.prisma.prayerGoal.deleteMany.mockRejectedValueOnce(DB_ERROR);
    await expect(deletePrayerGoalImpl(USER, ID)).resolves.toEqual({ ok: false, error: "delete_failed" });
  });
});

describe("plan tasks", () => {
  const row = { id: ID, title: "Zakat", isDone: false, dueDate: null, sortOrder: 0 };
  const dto = { id: ID, title: "Zakat", isDone: false, dueDate: null, sortOrder: 0 };

  it("list: maps rows (date column to YYYY-MM-DD); load_failed", async () => {
    m.prisma.planTask.findMany.mockResolvedValueOnce([row, { ...row, dueDate: new Date("2027-03-01T00:00:00Z"), sortOrder: 1 }]);
    await expect(listPlanTasksImpl(USER)).resolves.toEqual({
      ok: true,
      data: [dto, { ...dto, dueDate: "2027-03-01", sortOrder: 1 }],
    });
    m.prisma.planTask.findMany.mockRejectedValueOnce(DB_ERROR);
    await expect(listPlanTasksImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("create: creates with userId; invalid_input; save_failed", async () => {
    m.prisma.planTask.findFirst.mockResolvedValueOnce(null);
    m.prisma.planTask.create.mockResolvedValueOnce(row);
    await expect(createPlanTaskImpl(USER, { title: "Zakat" })).resolves.toEqual({ ok: true, data: dto });
    expect(m.prisma.planTask.create.mock.calls[0][0].data).toEqual({ userId: USER, title: "Zakat", sortOrder: 0 });
    await expect(createPlanTaskImpl(USER, { title: "   " })).resolves.toEqual({ ok: false, error: "invalid_input" });
    m.prisma.planTask.findFirst.mockResolvedValueOnce({ sortOrder: 4 });
    m.prisma.planTask.create.mockRejectedValueOnce(DB_ERROR);
    await expect(createPlanTaskImpl(USER, { title: "x" })).resolves.toEqual({ ok: false, error: "save_failed" });
    expect(m.prisma.planTask.create.mock.calls[1][0].data).toMatchObject({ sortOrder: 5 });
  });

  it("update: keyed by id AND userId; dueDate only when given; invalid_input; save_failed", async () => {
    m.prisma.planTask.update.mockResolvedValueOnce({ ...row, isDone: true });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "Zakat", isDone: true })).resolves.toEqual({
      ok: true,
      data: { ...dto, isDone: true },
    });
    const first = m.prisma.planTask.update.mock.calls[0][0];
    expect(first.where).toEqual({ id: ID, userId: USER });
    expect(first.data).not.toHaveProperty("dueDate");
    m.prisma.planTask.update.mockResolvedValueOnce({ ...row, isDone: true, dueDate: new Date("2027-03-01T00:00:00Z") });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "Zakat", isDone: true, dueDate: "2027-03-01" })).resolves.toEqual({
      ok: true,
      data: { ...dto, isDone: true, dueDate: "2027-03-01" },
    });
    expect(m.prisma.planTask.update.mock.calls[1][0].data).toMatchObject({
      isDone: true,
      dueDate: new Date("2027-03-01T00:00:00.000Z"),
    });
    m.prisma.planTask.update.mockResolvedValueOnce(row);
    await updatePlanTaskImpl(USER, { id: ID, title: "Zakat", isDone: false, dueDate: null });
    expect(m.prisma.planTask.update.mock.calls[2][0].data).toMatchObject({ dueDate: null });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "a", isDone: true, dueDate: "03-01-2027" })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "", isDone: true })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    m.prisma.planTask.update.mockRejectedValueOnce(DB_ERROR);
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "a", isDone: false })).resolves.toEqual({
      ok: false,
      error: "save_failed",
    });
  });

  it("delete: keyed by id AND userId; invalid_input; delete_failed", async () => {
    m.prisma.planTask.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(deletePlanTaskImpl(USER, ID)).resolves.toEqual({ ok: true, data: null });
    expect(m.prisma.planTask.deleteMany).toHaveBeenCalledWith({ where: { id: ID, userId: USER } });
    await expect(deletePlanTaskImpl(USER, "")).resolves.toEqual({ ok: false, error: "invalid_input" });
    m.prisma.planTask.deleteMany.mockRejectedValueOnce(DB_ERROR);
    await expect(deletePlanTaskImpl(USER, ID)).resolves.toEqual({ ok: false, error: "delete_failed" });
  });
});

describe("reminder rules", () => {
  const row = { id: ID, type: "iftar", label: "Iftar", offsetMinutes: -10, channels: ["push", "sms"], enabled: true };
  const dto = { id: ID, type: "iftar", label: "Iftar", offsetMinutes: -10, channels: ["push"], enabled: true };
  const input = { type: "iftar" as const, label: "Iftar", offsetMinutes: -10, channels: ["push" as const], enabled: true };

  it("list: maps rows (unknown channels dropped); load_failed", async () => {
    m.prisma.reminderRule.findMany.mockResolvedValueOnce([row]);
    await expect(listReminderRulesImpl(USER)).resolves.toEqual({ ok: true, data: [dto] });
    m.prisma.reminderRule.findMany.mockRejectedValueOnce(DB_ERROR);
    await expect(listReminderRulesImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("create: creates with userId; invalid_input; save_failed", async () => {
    m.prisma.reminderRule.create.mockResolvedValueOnce(row);
    await expect(createReminderRuleImpl(USER, input)).resolves.toEqual({ ok: true, data: dto });
    expect(m.prisma.reminderRule.create.mock.calls[0][0].data).toEqual({
      userId: USER,
      type: "iftar",
      label: "Iftar",
      offsetMinutes: -10,
      channels: ["push"],
      enabled: true,
    });
    await expect(createReminderRuleImpl(USER, { ...input, channels: [] })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    m.prisma.reminderRule.create.mockRejectedValueOnce(DB_ERROR);
    await expect(createReminderRuleImpl(USER, input)).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("update: keyed by id AND userId; invalid_input; save_failed", async () => {
    m.prisma.reminderRule.update.mockResolvedValueOnce(row);
    await expect(updateReminderRuleImpl(USER, { id: ID, ...input })).resolves.toEqual({ ok: true, data: dto });
    expect(m.prisma.reminderRule.update.mock.calls[0][0].where).toEqual({ id: ID, userId: USER });
    await expect(updateReminderRuleImpl(USER, { id: ID, ...input, offsetMinutes: 721 })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    m.prisma.reminderRule.update.mockRejectedValueOnce(DB_ERROR);
    await expect(updateReminderRuleImpl(USER, { id: ID, ...input })).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("delete: keyed by id AND userId; invalid_input; delete_failed", async () => {
    m.prisma.reminderRule.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(deleteReminderRuleImpl(USER, ID)).resolves.toEqual({ ok: true, data: null });
    expect(m.prisma.reminderRule.deleteMany).toHaveBeenCalledWith({ where: { id: ID, userId: USER } });
    await expect(deleteReminderRuleImpl(USER, "x")).resolves.toEqual({ ok: false, error: "invalid_input" });
    m.prisma.reminderRule.deleteMany.mockRejectedValueOnce(DB_ERROR);
    await expect(deleteReminderRuleImpl(USER, ID)).resolves.toEqual({ ok: false, error: "delete_failed" });
  });
});

describe("user profile", () => {
  const row = {
    id: USER,
    displayName: "Rafi",
    locale: "en",
    timezone: "Europe/London",
    latitude: 51.5,
    longitude: -0.12,
    locationLabel: "London",
  };
  const dto = { ...row };

  it("get: maps the row; defaults (with the Dhaka location label) when missing; load_failed", async () => {
    m.prisma.userProfile.findUnique.mockResolvedValueOnce(row);
    await expect(getUserProfileImpl(USER)).resolves.toEqual({ ok: true, data: dto });
    m.prisma.userProfile.findUnique.mockResolvedValueOnce(null);
    await expect(getUserProfileImpl(USER)).resolves.toEqual({
      ok: true,
      data: {
        id: USER,
        displayName: "",
        locale: "bn",
        timezone: "Asia/Dhaka",
        latitude: 23.8103,
        longitude: 90.4125,
        locationLabel: "ঢাকা, বাংলাদেশ",
      },
    });
    m.prisma.userProfile.findUnique.mockResolvedValueOnce({ ...row, locale: "fr", locationLabel: null, timezone: null });
    await expect(getUserProfileImpl(USER)).resolves.toEqual({
      ok: true,
      data: { ...dto, locale: "bn", locationLabel: "ঢাকা, বাংলাদেশ", timezone: "Asia/Dhaka" },
    });
    m.prisma.userProfile.findUnique.mockRejectedValueOnce(DB_ERROR);
    await expect(getUserProfileImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("update: upserts the user's own row (id = userId), coordinates rounded to 2 decimals; invalid_input; save_failed", async () => {
    const input = { displayName: "Rafi", timezone: "Europe/London", locationLabel: "London", latitude: 51.50735, longitude: -0.12776 };
    m.prisma.userProfile.upsert.mockResolvedValueOnce(row);
    await expect(updateUserProfileImpl(USER, input)).resolves.toEqual({ ok: true, data: dto });
    const args = m.prisma.userProfile.upsert.mock.calls[0][0];
    const fields = { displayName: "Rafi", timezone: "Europe/London", latitude: 51.51, longitude: -0.13, locationLabel: "London" };
    expect(args.where).toEqual({ id: USER });
    expect(args.create).toEqual({ id: USER, ...fields });
    expect(args.update).toEqual(fields);
    await expect(updateUserProfileImpl(USER, { ...input, latitude: 91 })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    m.prisma.userProfile.upsert.mockRejectedValueOnce(DB_ERROR);
    await expect(updateUserProfileImpl(USER, input)).resolves.toEqual({ ok: false, error: "save_failed" });
  });
});
