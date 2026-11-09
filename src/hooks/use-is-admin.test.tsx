// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as { id: string } | null, access: vi.fn() }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: state.user, loading: false, isGuest: !state.user }) }));
vi.mock("@/actions/admin-access", () => ({ getAdminAccessAction: state.access }));

import { useIsAdmin } from "./use-is-admin";

beforeEach(() => state.access.mockReset());

describe("useIsAdmin", () => {
  it("a guest is never an admin and triggers no request", () => {
    state.user = null;
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
    expect(state.access).not.toHaveBeenCalled();
  });

  it("a signed-in non-admin stays false", async () => {
    state.user = { id: "user-a" };
    state.access.mockResolvedValue("forbidden");
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(state.access).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);
  });

  it("an admin is true, checked once however many navs ask", async () => {
    state.user = { id: "user-b" };
    state.access.mockResolvedValue("ok");
    const a = renderHook(() => useIsAdmin());
    const b = renderHook(() => useIsAdmin());
    await waitFor(() => expect(a.result.current).toBe(true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(state.access).toHaveBeenCalledTimes(1);
  });
});
