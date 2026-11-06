// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WithIntl } from "@/components/prayer/test-utils";
import type { ActionResult, DailyLogDTO } from "@/actions/planner";

const api = vi.hoisted(() => ({
  getDailyLogAction: vi.fn(),
  saveDailyLogAction: vi.fn(),
}));
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false, isGuest: false }),
}));
vi.mock("@/actions/planner", () => api);

import { SalahTracker } from "./salah-tracker";

const log = (over: Partial<DailyLogDTO> = {}): DailyLogDTO => ({
  id: "log-1",
  day: 5,
  prayers: {},
  quran: { para: "", surah: "", ayah: "", pages: "" },
  checklist: [],
  journal: { reflection: "", myDua: "" },
  dayTaskDone: false,
  ...over,
});

/** A promise the test resolves by hand, to look at the UI while a request is in flight. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const wrapper = ({ children }: { children: ReactNode }) => <WithIntl>{children}</WithIntl>;
const fajr = () => screen.getAllByRole("button").find((b) => /fajr|ফজর/i.test(b.textContent ?? ""))!;

beforeEach(() => {
  localStorage.clear();
  api.getDailyLogAction.mockReset();
  api.saveDailyLogAction.mockReset();
});
afterEach(cleanup);

describe("SalahTracker (signed in)", () => {
  it("is locked until the day's log loads, and loads it with the local date", async () => {
    const load = deferred<ActionResult<DailyLogDTO | null>>();
    api.getDailyLogAction.mockReturnValue(load.promise);
    render(<SalahTracker day={5} />, { wrapper });
    expect(fajr()).toBeDisabled();
    act(() => fajr().click());
    expect(api.saveDailyLogAction).not.toHaveBeenCalled();
    expect(api.getDailyLogAction).toHaveBeenCalledWith(5, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

    await act(async () => load.resolve({ ok: true, data: log({ prayers: { isha: true } }) }));
    expect(fajr()).toBeEnabled();
  });

  it("rolls back a failed save and shows the error", async () => {
    api.getDailyLogAction.mockResolvedValue({ ok: true, data: log({ prayers: { isha: true } }) });
    const save = deferred<ActionResult<DailyLogDTO>>();
    api.saveDailyLogAction.mockReturnValue(save.promise);
    render(<SalahTracker day={5} />, { wrapper });
    await waitFor(() => expect(fajr()).toBeEnabled());

    act(() => fajr().click());
    // Optimistic, and locked while the save is in flight (each save sends the whole set).
    expect(fajr()).toHaveAttribute("aria-pressed", "true");
    expect(fajr()).toBeDisabled();
    expect(api.saveDailyLogAction).toHaveBeenCalledWith({
      day: 5,
      logDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      prayers: { isha: true, fajr: true },
    });

    await act(async () => save.resolve({ ok: false, error: "save_failed" }));
    expect(fajr()).toHaveAttribute("aria-pressed", "false");
    expect(fajr()).toBeEnabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("a thrown request also rolls back; a later success clears the error", async () => {
    api.getDailyLogAction.mockResolvedValue({ ok: true, data: log() });
    api.saveDailyLogAction.mockRejectedValueOnce(new Error("offline"));
    render(<SalahTracker day={5} />, { wrapper });
    await waitFor(() => expect(fajr()).toBeEnabled());
    await act(async () => fajr().click());
    expect(fajr()).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    api.saveDailyLogAction.mockResolvedValueOnce({ ok: true, data: log({ prayers: { fajr: true } }) });
    await act(async () => fajr().click());
    expect(fajr()).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a failed load keeps the toggles locked and says so", async () => {
    api.getDailyLogAction.mockResolvedValue({ ok: false, error: "load_failed" });
    render(<SalahTracker day={5} />, { wrapper });
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(fajr()).toBeDisabled();
  });
});
