// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: null as { id: string } | null, loading: false, isGuest: true } }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => auth.value }));

import { useGuestData } from "./use-guest-data";
import { useLocalDayKey } from "./use-local-day";
import { LOCATION_STORAGE_KEY, locationFromDistrict } from "@/lib/user-location";
import { DEFAULT_DISTRICT_ID, districtById } from "@/lib/districts";

function Count() {
  const { data } = useGuestData<{ n: number }>("probe_2027-02-20", { n: 0 });
  return <span>{data.n}</span>;
}

/** A counter under any key, with a button that adds one. */
function Counter({ storageKey }: { storageKey: string }) {
  const { data, updateData } = useGuestData<{ n: number }>(storageKey, { n: 0 });
  return (
    <button type="button" onClick={() => updateData((prev) => ({ n: prev.n + 1 }))}>
      {data.n}
    </button>
  );
}

/** A counter under today's local key (useLocalDayKey), like the trackers. */
function DayCounter() {
  const key = useLocalDayKey("probe");
  return (
    <div>
      <span data-testid="key">{key}</span>
      <Counter storageKey={key} />
    </div>
  );
}

const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  auth.value = { user: null, loading: false, isGuest: true };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useGuestData", () => {
  it("hydrates with the default value, then shows the stored data (no mismatch)", async () => {
    const html = renderToString(<Count />);
    expect(html).toContain("0");
    localStorage.setItem("rp_probe_2027-02-20", JSON.stringify({ n: 5 }));
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <Count />, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("5");
    // The stored value is kept (not overwritten by the default during hydration).
    expect(stored("rp_probe_2027-02-20")).toEqual({ n: 5 });
  });

  it("reloads when the key changes and never writes the old key's data under the new key", () => {
    localStorage.setItem("rp_probe_2027-02-20", JSON.stringify({ n: 3 }));
    const { rerender } = render(<Counter storageKey="probe_2027-02-20" />);
    expect(screen.getByRole("button").textContent).toBe("3");
    act(() => screen.getByRole("button").click());
    expect(stored("rp_probe_2027-02-20")).toEqual({ n: 4 });

    // Midnight: the new day has nothing stored yet.
    rerender(<Counter storageKey="probe_2027-02-21" />);
    expect(screen.getByRole("button").textContent).toBe("0");
    expect(localStorage.getItem("rp_probe_2027-02-21")).toBeNull();
    act(() => screen.getByRole("button").click());
    expect(stored("rp_probe_2027-02-21")).toEqual({ n: 1 });
    expect(stored("rp_probe_2027-02-20")).toEqual({ n: 4 });

    // Back to a key with data: it is loaded, not overwritten.
    rerender(<Counter storageKey="probe_2027-02-20" />);
    expect(screen.getByRole("button").textContent).toBe("4");
  });

  it("follows the local day in a long-lived tab (rollover at local midnight in Dhaka)", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2027-02-20T17:59:40Z")); // 23:59:40 in Dhaka
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationFromDistrict(districtById(DEFAULT_DISTRICT_ID)!)));
    localStorage.setItem("rp_probe_2027-02-20", JSON.stringify({ n: 7 }));
    render(<DayCounter />);
    expect(screen.getByTestId("key").textContent).toBe("probe_2027-02-20");
    expect(screen.getByRole("button").textContent).toBe("7");

    act(() => {
      vi.advanceTimersByTime(30_000); // the shared clock ticks past midnight
    });
    expect(screen.getByTestId("key").textContent).toBe("probe_2027-02-21");
    expect(screen.getByRole("button").textContent).toBe("0");
    expect(localStorage.getItem("rp_probe_2027-02-21")).toBeNull();
    act(() => screen.getByRole("button").click());
    expect(stored("rp_probe_2027-02-21")).toEqual({ n: 1 });
    expect(stored("rp_probe_2027-02-20")).toEqual({ n: 7 });
  });

  it("copies today's entry from the old UTC key once (Dhaka, before 06:00)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-02-19T23:30:00Z")); // 20 Feb, 05:30 in Dhaka
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationFromDistrict(districtById(DEFAULT_DISTRICT_ID)!)));
    localStorage.setItem("rp_probe_2027-02-19", JSON.stringify({ n: 2 })); // written under the UTC date
    render(<DayCounter />);
    expect(screen.getByTestId("key").textContent).toBe("probe_2027-02-20");
    expect(screen.getByRole("button").textContent).toBe("2");
    expect(stored("rp_probe_2027-02-19")).toEqual({ n: 2 });
  });

  it("writes nothing on mount, nothing for a signed-in user, and waits while auth loads", () => {
    vi.useFakeTimers();
    render(<Counter storageKey="probe_2027-02-20" />);
    expect(localStorage.length).toBe(0);
    cleanup();

    auth.value = { user: { id: "u1" }, loading: false, isGuest: false };
    render(<Counter storageKey="probe_2027-02-20" />);
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("1");
    expect(localStorage.getItem("rp_probe_2027-02-20")).toBeNull();
    cleanup();

    // Auth still loading: the write waits; a guest's change is kept once the auth wait is over.
    auth.value = { user: null, loading: true, isGuest: true };
    render(<Counter storageKey="probe_2027-02-20" />);
    act(() => screen.getByRole("button").click());
    expect(localStorage.getItem("rp_probe_2027-02-20")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(stored("rp_probe_2027-02-20")).toEqual({ n: 1 });
  });
});
