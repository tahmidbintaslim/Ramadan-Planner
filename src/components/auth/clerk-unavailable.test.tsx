// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { WithIntl } from "@/components/prayer/test-utils";

const clerk = vi.hoisted(() => ({ status: "loading" as "loading" | "ready" | "error" }));
vi.mock("@clerk/tanstack-react-start", () => ({
  ClerkFailed: ({ children }: { children: ReactNode }) => (clerk.status === "error" ? children : null),
  ClerkLoading: ({ children }: { children: ReactNode }) => (clerk.status === "loading" ? children : null),
}));

import { CLERK_FALLBACK_MS, ClerkGate } from "./clerk-unavailable";

window.scrollTo = (() => {}) as typeof window.scrollTo;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  clerk.status = "loading";
});

async function renderGate(mode: "signIn" | "signUp", locale: "bn" | "en" = "bn") {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <WithIntl locale={locale}>
        <ClerkGate mode={mode}>
          <p>clerk form</p>
        </ClerkGate>
      </WithIntl>
    ),
  });
  const router = createRouter({ routeTree: root.addChildren([index]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByText("clerk form");
}

describe("ClerkGate", () => {
  it("shows only the form while Clerk loads, then the fallback after the timeout", async () => {
    await renderGate("signIn");
    vi.useFakeTimers();
    expect(screen.queryByTestId("clerk-unavailable")).toBeNull();
    act(() => vi.advanceTimersByTime(CLERK_FALLBACK_MS - 100));
    expect(screen.queryByTestId("clerk-unavailable")).toBeNull();
  });

  it("the fallback says sign-in is unavailable, the app works without an account, and links to /today", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderGate("signIn");
    act(() => vi.advanceTimersByTime(CLERK_FALLBACK_MS + 10));
    const card = await screen.findByTestId("clerk-unavailable");
    expect(card).toHaveTextContent("এই মুহূর্তে সাইন ইন করা যাচ্ছে না");
    expect(card).toHaveTextContent("অ্যাকাউন্ট ছাড়াই অ্যাপটি কাজ করে");
    expect(screen.getByRole("link", { name: "অ্যাকাউন্ট ছাড়াই চালিয়ে যান" })).toHaveAttribute("href", "/today");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("shows the fallback at once when Clerk fails, and never once it is ready", async () => {
    clerk.status = "error";
    await renderGate("signUp", "en");
    expect(screen.getByTestId("clerk-unavailable")).toHaveTextContent("Sign-up is unavailable right now");
    cleanup();
    clerk.status = "ready";
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderGate("signUp", "en");
    act(() => vi.advanceTimersByTime(CLERK_FALLBACK_MS + 10));
    expect(screen.queryByTestId("clerk-unavailable")).toBeNull();
  });
});
