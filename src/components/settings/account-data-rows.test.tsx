// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
  deleteAccountAction: vi.fn(),
  exportAccountDataAction: vi.fn(),
  clearPersonalDeviceData: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({ useClerk: () => ({ signOut: m.signOut }) }));
vi.mock("@/actions/account", () => ({
  deleteAccountAction: m.deleteAccountAction,
  exportAccountDataAction: m.exportAccountDataAction,
}));
vi.mock("@/lib/sign-out-cleanup", () => ({ clearPersonalDeviceData: m.clearPersonalDeviceData }));

import { AccountDataRows } from "./account-data-rows";

window.scrollTo = (() => {}) as typeof window.scrollTo;
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function renderRows(signedIn: boolean) {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <WithIntl>
        <AccountDataRows signedIn={signedIn} />
      </WithIntl>
    ),
  });
  const router = createRouter({ routeTree: root.addChildren([index]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByText("গোপনীয়তা");
}

describe("AccountDataRows", () => {
  it("a guest sees only the privacy link", async () => {
    await renderRows(false);
    expect(screen.getByRole("link", { name: "গোপনীয়তা" })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByTestId("delete-account")).toBeNull();
    expect(screen.queryByTestId("export-data")).toBeNull();
  });

  it("delete asks first; cancel deletes nothing", async () => {
    await renderRows(true);
    fireEvent.click(screen.getByTestId("delete-account"));
    expect(await screen.findByRole("dialog")).toHaveTextContent("অ্যাকাউন্ট মুছে ফেলবেন?");
    fireEvent.click(screen.getByRole("button", { name: "বাতিল করুন" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(m.deleteAccountAction).not.toHaveBeenCalled();
  });

  it("confirming deletes, clears the device and signs out", async () => {
    m.deleteAccountAction.mockResolvedValue({ ok: true, data: null });
    await renderRows(true);
    fireEvent.click(screen.getByTestId("delete-account"));
    fireEvent.click(await screen.findByTestId("delete-account-confirm"));
    await waitFor(() => expect(m.signOut).toHaveBeenCalledWith({ redirectUrl: "/?deleted=1" }));
    expect(m.deleteAccountAction).toHaveBeenCalledTimes(1);
    expect(m.clearPersonalDeviceData).toHaveBeenCalled();
  });

  it("a failed deletion stays signed in and says so", async () => {
    m.deleteAccountAction.mockResolvedValue({ ok: false, error: "auth_delete_failed" });
    await renderRows(true);
    fireEvent.click(screen.getByTestId("delete-account"));
    fireEvent.click(await screen.findByTestId("delete-account-confirm"));
    expect(await screen.findByRole("alert")).toHaveTextContent("অ্যাকাউন্ট পুরোপুরি মোছা যায়নি");
    expect(m.signOut).not.toHaveBeenCalled();
  });
});
