import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny fake of the supabase-js query builder: records every chain (table + calls) and answers each
// awaited chain with the next queued result. No network, no database.
type Op = [string, ...unknown[]];
interface Chain {
  table: string;
  ops: Op[];
}
interface QueryResult {
  data: unknown;
  error: unknown;
}

const fake = vi.hoisted(() => {
  const state = { chains: [] as Chain[], results: [] as QueryResult[] };
  const client = {
    from(table: string) {
      const chain: Chain = { table, ops: [] };
      state.chains.push(chain);
      const next = () => Promise.resolve(state.results.shift() ?? { data: null, error: null });
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "insert", "update", "upsert", "delete"]) {
        builder[m] = (...args: unknown[]) => {
          chain.ops.push([m, ...args]);
          return builder;
        };
      }
      for (const m of ["maybeSingle", "single"]) {
        builder[m] = () => {
          chain.ops.push([m]);
          return next();
        };
      }
      builder.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
        next().then(onFulfilled, onRejected);
      return builder;
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => fake.client) }));

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

const USER = "db99edd8-fa85-5bc2-95ec-a499147bb210";
const OTHER = "a39f6e52-2892-5520-97d5-9ece2f1c9841";
const ID = "11111111-1111-4111-8111-111111111111";
const DB_ERROR = { message: "boom", code: "XX000" };

const queue = (...results: QueryResult[]) => fake.state.results.push(...results);
const chains = () => fake.state.chains;
const opsOf = (chain: Chain, name: string) => chain.ops.filter((op) => op[0] === name);

/**
 * Data isolation: every chain must be scoped to USER, by an `.eq("user_id", USER)` filter or, for writes,
 * by `user_id: USER` in the payload (user_profiles uses its primary key `id`). Nothing may name OTHER.
 */
function expectScopedToUser(chain: Chain) {
  const ownerColumn = chain.table === "user_profiles" ? "id" : "user_id";
  const writes = [...opsOf(chain, "insert"), ...opsOf(chain, "upsert")];
  if (writes.length > 0) {
    for (const [, payload] of writes) {
      expect((payload as Record<string, unknown>)[ownerColumn], `${chain.table} write owner`).toBe(USER);
    }
  } else {
    expect(chain.ops, `${chain.table} must filter by ${ownerColumn}`).toContainEqual(["eq", ownerColumn, USER]);
  }
  expect(JSON.stringify(chain.ops)).not.toContain(OTHER);
}

beforeEach(() => {
  fake.state.chains.length = 0;
  fake.state.results.length = 0;
});

afterEach(() => {
  // Applies to every test below: whatever queries ran were all scoped to USER.
  for (const chain of chains()) expectScopedToUser(chain);
});

describe("daily logs", () => {
  const row = {
    id: "log-1",
    day: 3,
    prayers: { fajr: true },
    quran_para: 2,
    quran_surah: "Al-Baqarah",
    quran_ayah: 10,
    quran_pages: 0,
    checklist: ["a", 5],
    journal_text: "r",
    my_dua: "d",
    day_task_done: true,
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

  it("getDailyLog: returns the normalized DTO for the user's row", async () => {
    queue({ data: row, error: null });
    await expect(getDailyLogImpl(USER, 3)).resolves.toEqual({ ok: true, data: dto });
    expect(chains()).toHaveLength(1);
    expect(chains()[0].table).toBe("daily_logs");
    expect(chains()[0].ops).toContainEqual(["eq", "day", 3]);
  });

  it("getDailyLog: null when there is no row; invalid_day; load_failed", async () => {
    queue({ data: null, error: null });
    await expect(getDailyLogImpl(USER, 1)).resolves.toEqual({ ok: true, data: null });
    await expect(getDailyLogImpl(USER, 31)).resolves.toEqual({ ok: false, error: "invalid_day" });
    await expect(getDailyLogImpl(USER, 1.5)).resolves.toEqual({ ok: false, error: "invalid_day" });
    queue({ data: null, error: DB_ERROR });
    await expect(getDailyLogImpl(USER, 2)).resolves.toEqual({ ok: false, error: "load_failed" });
    expect(chains()).toHaveLength(2); // the invalid calls never queried
  });

  it("saveDailyLog: upserts with user_id and merges unspecified fields from the existing row", async () => {
    queue({ data: row, error: null }, { data: { ...row, prayers: { fajr: true, isha: true } }, error: null });
    const result = await saveDailyLogImpl(USER, { day: 3, prayers: { fajr: true, isha: true } });
    expect(result).toEqual({ ok: true, data: { ...dto, prayers: { fajr: true, isha: true } } });
    expect(chains()).toHaveLength(2);
    const [, payload, options] = opsOf(chains()[1], "upsert")[0];
    expect(payload).toMatchObject({
      user_id: USER,
      day: 3,
      prayers: { fajr: true, isha: true },
      checklist: ["a", 5],
      quran_para: 2,
      quran_surah: "Al-Baqarah",
      journal_text: "r",
      my_dua: "d",
      day_task_done: true,
    });
    expect(options).toEqual({ onConflict: "user_id,day" });
  });

  it("saveDailyLog: invalid_input and save_failed", async () => {
    await expect(saveDailyLogImpl(USER, { day: 0 })).resolves.toEqual({ ok: false, error: "invalid_input" });
    expect(chains()).toHaveLength(0);
    queue({ data: null, error: null }, { data: null, error: DB_ERROR });
    await expect(saveDailyLogImpl(USER, { day: 4 })).resolves.toEqual({ ok: false, error: "save_failed" });
  });
});

describe("prayer goals", () => {
  const row = { id: ID, title: "Tahajjud", target_count: 10, target_unit: "nights", is_completed: false, sort_order: 2 };
  const dto = { id: ID, title: "Tahajjud", targetCount: 10, targetUnit: "nights", isCompleted: false, sortOrder: 2 };

  it("list: maps rows, ordered; load_failed on error", async () => {
    queue({ data: [row], error: null });
    await expect(listPrayerGoalsImpl(USER)).resolves.toEqual({ ok: true, data: [dto] });
    expect(chains()[0].ops).toContainEqual(["order", "sort_order", { ascending: true }]);
    queue({ data: null, error: DB_ERROR });
    await expect(listPrayerGoalsImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("create: next sort order, inserts with user_id; invalid_input; save_failed", async () => {
    queue({ data: { sort_order: 1 }, error: null }, { data: row, error: null });
    await expect(
      createPrayerGoalImpl(USER, { title: " Tahajjud ", targetCount: 10, targetUnit: "nights" }),
    ).resolves.toEqual({ ok: true, data: dto });
    expect(opsOf(chains()[1], "insert")[0][1]).toEqual({
      user_id: USER,
      title: "Tahajjud",
      target_count: 10,
      target_unit: "nights",
      sort_order: 2,
    });
    await expect(
      createPrayerGoalImpl(USER, { title: "", targetCount: 10, targetUnit: "nights" }),
    ).resolves.toEqual({ ok: false, error: "invalid_input" });
    queue({ data: null, error: null }, { data: null, error: DB_ERROR });
    await expect(
      createPrayerGoalImpl(USER, { title: "x", targetCount: 1, targetUnit: "times" }),
    ).resolves.toEqual({ ok: false, error: "save_failed" });
    expect(opsOf(chains()[3], "insert")[0][1]).toMatchObject({ user_id: USER, sort_order: 0 });
  });

  it("update: filters by id AND user_id; invalid_input; save_failed", async () => {
    queue({ data: { ...row, is_completed: true }, error: null });
    const input = { id: ID, title: "Tahajjud", targetCount: 10, targetUnit: "nights", isCompleted: true };
    await expect(updatePrayerGoalImpl(USER, input)).resolves.toEqual({ ok: true, data: { ...dto, isCompleted: true } });
    expect(chains()[0].ops).toContainEqual(["eq", "id", ID]);
    await expect(updatePrayerGoalImpl(USER, { ...input, id: "nope" })).resolves.toEqual({ ok: false, error: "invalid_input" });
    queue({ data: null, error: DB_ERROR });
    await expect(updatePrayerGoalImpl(USER, input)).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("delete: filters by id AND user_id; invalid_input; delete_failed", async () => {
    queue({ data: null, error: null });
    await expect(deletePrayerGoalImpl(USER, ID)).resolves.toEqual({ ok: true, data: null });
    expect(chains()[0].ops).toEqual([["delete"], ["eq", "id", ID], ["eq", "user_id", USER]]);
    await expect(deletePrayerGoalImpl(USER, "nope")).resolves.toEqual({ ok: false, error: "invalid_input" });
    queue({ data: null, error: DB_ERROR });
    await expect(deletePrayerGoalImpl(USER, ID)).resolves.toEqual({ ok: false, error: "delete_failed" });
  });
});

describe("plan tasks", () => {
  const row = { id: ID, title: "Zakat", is_done: false, due_date: null, sort_order: 0 };
  const dto = { id: ID, title: "Zakat", isDone: false, dueDate: null, sortOrder: 0 };

  it("list: maps rows; load_failed", async () => {
    queue({ data: [row, { ...row, due_date: "2027-03-01", sort_order: 1 }], error: null });
    await expect(listPlanTasksImpl(USER)).resolves.toEqual({
      ok: true,
      data: [dto, { ...dto, dueDate: "2027-03-01", sortOrder: 1 }],
    });
    queue({ data: null, error: DB_ERROR });
    await expect(listPlanTasksImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("create: inserts with user_id; invalid_input; save_failed", async () => {
    queue({ data: null, error: null }, { data: row, error: null });
    await expect(createPlanTaskImpl(USER, { title: "Zakat" })).resolves.toEqual({ ok: true, data: dto });
    expect(opsOf(chains()[1], "insert")[0][1]).toEqual({ user_id: USER, title: "Zakat", sort_order: 0 });
    await expect(createPlanTaskImpl(USER, { title: "   " })).resolves.toEqual({ ok: false, error: "invalid_input" });
    queue({ data: { sort_order: 4 }, error: null }, { data: null, error: DB_ERROR });
    await expect(createPlanTaskImpl(USER, { title: "x" })).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("update: filters by id AND user_id; invalid_input; save_failed", async () => {
    queue({ data: { ...row, is_done: true }, error: null });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "Zakat", isDone: true })).resolves.toEqual({
      ok: true,
      data: { ...dto, isDone: true },
    });
    expect(chains()[0].ops).toContainEqual(["eq", "id", ID]);
    expect(opsOf(chains()[0], "update")[0][1]).not.toHaveProperty("due_date");
    queue({ data: { ...row, is_done: true, due_date: "2027-03-01" }, error: null });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "Zakat", isDone: true, dueDate: "2027-03-01" })).resolves.toEqual({
      ok: true,
      data: { ...dto, isDone: true, dueDate: "2027-03-01" },
    });
    expect(opsOf(chains()[1], "update")[0][1]).toMatchObject({ is_done: true, due_date: "2027-03-01" });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "a", isDone: true, dueDate: "03-01-2027" })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "", isDone: true })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    queue({ data: null, error: DB_ERROR });
    await expect(updatePlanTaskImpl(USER, { id: ID, title: "a", isDone: false })).resolves.toEqual({
      ok: false,
      error: "save_failed",
    });
  });

  it("delete: filters by id AND user_id; invalid_input; delete_failed", async () => {
    queue({ data: null, error: null });
    await expect(deletePlanTaskImpl(USER, ID)).resolves.toEqual({ ok: true, data: null });
    expect(chains()[0].ops).toEqual([["delete"], ["eq", "id", ID], ["eq", "user_id", USER]]);
    await expect(deletePlanTaskImpl(USER, "")).resolves.toEqual({ ok: false, error: "invalid_input" });
    queue({ data: null, error: DB_ERROR });
    await expect(deletePlanTaskImpl(USER, ID)).resolves.toEqual({ ok: false, error: "delete_failed" });
  });
});

describe("reminder rules", () => {
  const row = { id: ID, type: "iftar", label: "Iftar", offset_minutes: -10, channels: ["push", "sms"], enabled: true };
  const dto = { id: ID, type: "iftar", label: "Iftar", offsetMinutes: -10, channels: ["push"], enabled: true };
  const input = { type: "iftar" as const, label: "Iftar", offsetMinutes: -10, channels: ["push" as const], enabled: true };

  it("list: maps rows (unknown channels dropped); load_failed", async () => {
    queue({ data: [row], error: null });
    await expect(listReminderRulesImpl(USER)).resolves.toEqual({ ok: true, data: [dto] });
    queue({ data: null, error: DB_ERROR });
    await expect(listReminderRulesImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("create: inserts with user_id; invalid_input; save_failed", async () => {
    queue({ data: row, error: null });
    await expect(createReminderRuleImpl(USER, input)).resolves.toEqual({ ok: true, data: dto });
    expect(opsOf(chains()[0], "insert")[0][1]).toEqual({
      user_id: USER,
      type: "iftar",
      label: "Iftar",
      offset_minutes: -10,
      channels: ["push"],
      enabled: true,
    });
    await expect(createReminderRuleImpl(USER, { ...input, channels: [] })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    queue({ data: null, error: DB_ERROR });
    await expect(createReminderRuleImpl(USER, input)).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("update: filters by id AND user_id; invalid_input; save_failed", async () => {
    queue({ data: row, error: null });
    await expect(updateReminderRuleImpl(USER, { id: ID, ...input })).resolves.toEqual({ ok: true, data: dto });
    expect(chains()[0].ops).toContainEqual(["eq", "id", ID]);
    await expect(updateReminderRuleImpl(USER, { id: ID, ...input, offsetMinutes: 721 })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    queue({ data: null, error: DB_ERROR });
    await expect(updateReminderRuleImpl(USER, { id: ID, ...input })).resolves.toEqual({ ok: false, error: "save_failed" });
  });

  it("delete: filters by id AND user_id; invalid_input; delete_failed", async () => {
    queue({ data: null, error: null });
    await expect(deleteReminderRuleImpl(USER, ID)).resolves.toEqual({ ok: true, data: null });
    expect(chains()[0].ops).toEqual([["delete"], ["eq", "id", ID], ["eq", "user_id", USER]]);
    await expect(deleteReminderRuleImpl(USER, "x")).resolves.toEqual({ ok: false, error: "invalid_input" });
    queue({ data: null, error: DB_ERROR });
    await expect(deleteReminderRuleImpl(USER, ID)).resolves.toEqual({ ok: false, error: "delete_failed" });
  });
});

describe("user profile", () => {
  const row = {
    id: USER,
    display_name: "Rafi",
    locale: "en",
    timezone: "Europe/London",
    latitude: 51.5,
    longitude: -0.12,
    location_label: "London",
  };
  const dto = {
    id: USER,
    displayName: "Rafi",
    locale: "en",
    timezone: "Europe/London",
    latitude: 51.5,
    longitude: -0.12,
    locationLabel: "London",
  };

  it("get: maps the row; defaults when missing; load_failed", async () => {
    queue({ data: row, error: null });
    await expect(getUserProfileImpl(USER)).resolves.toEqual({ ok: true, data: dto });
    queue({ data: null, error: null });
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
    queue({ data: null, error: DB_ERROR });
    await expect(getUserProfileImpl(USER)).resolves.toEqual({ ok: false, error: "load_failed" });
  });

  it("update: upserts the user's own row (id = userId); invalid_input; save_failed", async () => {
    const input = { displayName: "Rafi", timezone: "Europe/London", locationLabel: "London", latitude: 51.5, longitude: -0.12 };
    queue({ data: row, error: null });
    await expect(updateUserProfileImpl(USER, input)).resolves.toEqual({ ok: true, data: dto });
    const [, payload, options] = opsOf(chains()[0], "upsert")[0];
    expect(payload).toEqual({
      id: USER,
      display_name: "Rafi",
      timezone: "Europe/London",
      latitude: 51.5,
      longitude: -0.12,
      location_label: "London",
    });
    expect(options).toEqual({ onConflict: "id" });
    await expect(updateUserProfileImpl(USER, { ...input, latitude: 91 })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    queue({ data: null, error: DB_ERROR });
    await expect(updateUserProfileImpl(USER, input)).resolves.toEqual({ ok: false, error: "save_failed" });
  });
});
