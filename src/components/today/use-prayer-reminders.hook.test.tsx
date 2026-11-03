// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGuestReminderRules, resetGuestReminderStoreForTests, useGuestReminderRules } from "@/lib/guest-reminders";

const auth = vi.hoisted(() => ({ value: { user: null, loading: false, isGuest: true } as Record<string, unknown> }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => auth.value }));

const actions = vi.hoisted(() => ({
  listReminderRulesAction: vi.fn(async () => ({ ok: true, data: [] })),
  createReminderRuleAction: vi.fn(),
  updateReminderRuleAction: vi.fn(),
}));
vi.mock("@/actions/planner", () => actions);

import { usePrayerReminders } from "./use-prayer-reminders";

afterEach(() => {
  localStorage.clear();
  resetGuestReminderStoreForTests();
  vi.clearAllMocks();
});

describe("usePrayerReminders (guest)", () => {
  it("writes to the shared store, so other readers (the daily tracker) update at once", () => {
    auth.value = { user: null, loading: false, isGuest: true };
    const bells = renderHook(() => usePrayerReminders());
    const tracker = renderHook(() => useGuestReminderRules());
    act(() => bells.result.current.toggle("asr", true));
    expect(bells.result.current.reminders.asr).toBe(true);
    expect(tracker.result.current.data).toEqual([expect.objectContaining({ type: "asr", enabled: true })]);
    // A quick second tap on "on" does not add a duplicate.
    act(() => bells.result.current.toggle("asr", true));
    expect(readGuestReminderRules()).toHaveLength(1);
  });
});

describe("usePrayerReminders (signed in)", () => {
  it("ignores a double tap while the create is in flight and shows the requested state", async () => {
    auth.value = { user: { id: "u1" }, loading: false, isGuest: false };
    let resolve!: (v: unknown) => void;
    actions.createReminderRuleAction.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => usePrayerReminders());
    await waitFor(() => expect(actions.listReminderRulesAction).toHaveBeenCalled());

    act(() => result.current.toggle("fajr", true));
    act(() => result.current.toggle("fajr", true));
    expect(actions.createReminderRuleAction).toHaveBeenCalledTimes(1);
    expect(result.current.reminders.fajr).toBe(true);

    await act(async () => {
      resolve({
        ok: true,
        data: { id: "r1", type: "fajr", label: "", offsetMinutes: -15, channels: ["push"], enabled: true },
      });
    });
    expect(result.current.reminders.fajr).toBe(true);
    // Settled: the next tap (off) goes through as an update.
    actions.updateReminderRuleAction.mockResolvedValue({ ok: true, data: {} });
    await act(async () => result.current.toggle("fajr", false));
    expect(actions.updateReminderRuleAction).toHaveBeenCalledWith(expect.objectContaining({ id: "r1", enabled: false }));
    await waitFor(() => expect(result.current.reminders.fajr).toBe(false));
  });

  it("drops the optimistic state when the server refuses", async () => {
    auth.value = { user: { id: "u1" }, loading: false, isGuest: false };
    actions.createReminderRuleAction.mockResolvedValue({ ok: false, error: "x" });
    const { result } = renderHook(() => usePrayerReminders());
    await waitFor(() => expect(actions.listReminderRulesAction).toHaveBeenCalled());
    await act(async () => result.current.toggle("isha", true));
    await waitFor(() => expect(result.current.reminders.isha).toBe(false));
  });
});
