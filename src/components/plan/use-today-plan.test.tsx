// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WithIntl } from "@/components/prayer/test-utils";
import { PLAN_ITEM_META_KEY } from "./plan-item-meta";

const api = vi.hoisted(() => ({ goalSaveOk: false }));
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false, isGuest: false }),
}));
vi.mock("@/actions/planner", () => ({
  listPrayerGoalsAction: vi.fn(async () => ({
    ok: true,
    data: [{ id: "g1", title: "যিকর", targetCount: 100, targetUnit: "বার", isCompleted: true, sortOrder: 0 }],
  })),
  listPlanTasksAction: vi.fn(async () => ({ ok: true, data: [] })),
  updatePrayerGoalAction: vi.fn(async (g: unknown) => (api.goalSaveOk ? { ok: true, data: g } : { ok: false, error: "x" })),
  createPlanTaskAction: vi.fn(),
  createPrayerGoalAction: vi.fn(),
  deletePlanTaskAction: vi.fn(),
  deletePrayerGoalAction: vi.fn(),
  updatePlanTaskAction: vi.fn(),
}));

import { useTodayPlan } from "./use-today-plan";

const wrapper = ({ children }: { children: ReactNode }) => <WithIntl>{children}</WithIntl>;
const doneOn = () => JSON.parse(localStorage.getItem(PLAN_ITEM_META_KEY) || "{}").g1?.doneOn;

describe("useTodayPlan goal ticks (signed in)", () => {
  beforeEach(() => {
    localStorage.clear();
    // Completed on an earlier day: not done today.
    localStorage.setItem(PLAN_ITEM_META_KEY, JSON.stringify({ g1: { doneOn: "2027-02-19" } }));
  });

  it("a failed save restores the goal's previous tick day, so today stays not done", async () => {
    api.goalSaveOk = false;
    const { result } = renderHook(() => useTodayPlan("2027-02-20"), { wrapper });
    await waitFor(() => expect(result.current.plan.ready).toBe(true));
    expect(result.current.rows[0]).toMatchObject({ id: "g1", done: false });
    await act(async () => {
      result.current.toggleRow(result.current.rows[0], true);
    });
    await waitFor(() => expect(result.current.plan.pending.size).toBe(0));
    expect(doneOn()).toBe("2027-02-19");
    expect(result.current.rows[0].done).toBe(false);
    expect(result.current.done).toBe(0);
  });

  it("a saved tick records today", async () => {
    api.goalSaveOk = true;
    const { result } = renderHook(() => useTodayPlan("2027-02-20"), { wrapper });
    await waitFor(() => expect(result.current.plan.ready).toBe(true));
    await act(async () => {
      result.current.toggleRow(result.current.rows[0], true);
    });
    await waitFor(() => expect(result.current.plan.pending.size).toBe(0));
    expect(doneOn()).toBe("2027-02-20");
    expect(result.current.rows[0].done).toBe(true);
  });
});
