// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const auth = { user: null as { id: string } | null, loading: true, isGuest: true };
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate }) }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => auth }));

import { useOnboardingGate } from "./use-onboarding-gate";
import { GUEST_AUTH_WAIT_MS } from "@/lib/user-location";

beforeEach(() => {
  navigate.mockClear();
  Object.assign(auth, { user: null, loading: true, isGuest: true });
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.cookie = "__client_uat=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("useOnboardingGate", () => {
  it("clears at once with a stored location", () => {
    localStorage.setItem("rp_location", JSON.stringify({ v: 1, kind: "default", districtId: "dhaka", lat: 23.81, lng: 90.41, tz: "Asia/Dhaka" }));
    const { result } = renderHook(() => useOnboardingGate());
    expect(result.current).toBe("clear");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a first visit with no session cookie onboards at once, without waiting for auth", () => {
    const { result } = renderHook(() => useOnboardingGate());
    expect(result.current).toBe("onboard");
    expect(navigate).toHaveBeenCalledWith({ to: "/welcome", replace: true });
  });

  it("waits for auth, then onboards a resolved guest", () => {
    document.cookie = "__client_uat=0; path=/";
    const { result, rerender } = renderHook(() => useOnboardingGate());
    expect(result.current).toBe("wait");
    Object.assign(auth, { loading: false });
    rerender();
    expect(result.current).toBe("onboard");
    expect(navigate).toHaveBeenCalledWith({ to: "/welcome", replace: true });
  });

  it("treats an auth client that never answers as a guest after the timeout", () => {
    vi.useFakeTimers();
    document.cookie = "__client_uat=0; path=/";
    const { result } = renderHook(() => useOnboardingGate());
    expect(result.current).toBe("wait");
    act(() => vi.advanceTimersByTime(GUEST_AUTH_WAIT_MS));
    expect(result.current).toBe("onboard");
  });

  it("a signed-in user is cleared, and signing out later does not bounce to onboarding", () => {
    Object.assign(auth, { loading: false, user: { id: "u1" }, isGuest: false });
    const { result, rerender } = renderHook(() => useOnboardingGate());
    expect(result.current).toBe("clear");
    Object.assign(auth, { user: null, isGuest: true });
    rerender();
    expect(result.current).toBe("clear");
    expect(navigate).not.toHaveBeenCalled();
  });
});
