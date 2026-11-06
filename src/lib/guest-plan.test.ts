// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { GUEST_PLAN_GOALS_KEY, GUEST_PLAN_TASKS_KEY, migrateGuestPlanList } from "./guest-plan";

const task = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  isDone: false,
  dueDate: null,
  sortOrder: 0,
  ...extra,
});
const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");

beforeEach(() => localStorage.clear());

describe("migrateGuestPlanList (dated lists to the fixed key)", () => {
  it("merges the two newest non-empty dated lists, newest first; matches by id and by title", () => {
    localStorage.setItem("rp_plan_tasks_2027-02-15", JSON.stringify([task("old", "Very old")]));
    localStorage.setItem("rp_plan_tasks_2027-02-18", JSON.stringify([task("a", "Zakat"), task("b", "Sadaqah")]));
    // The old hook wrote [] to each new day's key on first visit: an empty list is skipped.
    localStorage.setItem("rp_plan_tasks_2027-02-20", JSON.stringify([]));
    localStorage.setItem(
      "rp_plan_tasks_2027-02-19",
      JSON.stringify([task("a", "Zakat", { isDone: true, dueDate: "2027-02-19" }), task("c", "sadaqah ")]),
    );

    expect(migrateGuestPlanList(GUEST_PLAN_TASKS_KEY)).toBe(true);
    expect(read("rp_plan_tasks")).toEqual([
      task("a", "Zakat", { isDone: true, dueDate: "2027-02-19", sortOrder: 0 }), // the newer version wins
      task("c", "sadaqah ", { sortOrder: 1 }),
      // "b" (same title as "c") and the 2027-02-15 list are not brought back
    ]);
    // The dated lists stay (the 7-day prune expires them).
    expect(read("rp_plan_tasks_2027-02-18")).toHaveLength(2);
  });

  it("runs once: an existing fixed list is never replaced", () => {
    localStorage.setItem("rp_plan_goals", JSON.stringify([]));
    localStorage.setItem("rp_plan_goals_2027-02-19", JSON.stringify([{ id: "g", title: "Tahajjud" }]));
    expect(migrateGuestPlanList(GUEST_PLAN_GOALS_KEY)).toBe(false);
    expect(read("rp_plan_goals")).toEqual([]);
  });

  it("only empty dated lists: stores an empty list; no dated lists: writes nothing", () => {
    localStorage.setItem("rp_plan_goals_2027-02-19", "[]");
    expect(migrateGuestPlanList(GUEST_PLAN_GOALS_KEY)).toBe(false);
    expect(read("rp_plan_goals")).toEqual([]);
    expect(migrateGuestPlanList(GUEST_PLAN_TASKS_KEY)).toBe(false);
    expect(localStorage.getItem("rp_plan_tasks")).toBeNull();
  });

  it("ignores malformed entries and never throws", () => {
    localStorage.setItem("rp_plan_tasks_2027-02-19", "{not json");
    localStorage.setItem("rp_plan_tasks_2027-02-18", JSON.stringify([task("a", "Zakat")]));
    expect(migrateGuestPlanList(GUEST_PLAN_TASKS_KEY)).toBe(true);
    expect(read("rp_plan_tasks")).toEqual([task("a", "Zakat")]);
    expect(migrateGuestPlanList(GUEST_PLAN_TASKS_KEY, undefined)).toBe(false);
  });
});
