// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { writeLastRead } from "@/lib/quran-last-read";
import { QuranSurahList } from "./quran-surah-list";

window.scrollTo = (() => {}) as typeof window.scrollTo;

beforeEach(() => {
  // No API in tests: the embedded first-ten list is used.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function renderList(locale: "bn" | "en" = "bn") {
  const node: ReactNode = (
    <WithIntl locale={locale}>
      <QuranSurahList />
    </WithIntl>
  );
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => node });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  await screen.findByTestId("surah-list");
}

describe("Quran list", () => {
  it("shows the title and caption, and one linked row per surah with a Bengali-digit badge", async () => {
    await renderList();
    expect(screen.getByRole("heading", { level: 1, name: "আল কুরআন" })).toBeInTheDocument();
    const rows = within(screen.getByTestId("surah-list")).getAllByRole("link");
    expect(rows).toHaveLength(10);
    expect(rows[1]).toHaveAttribute("href", "/quran/2");
    expect(rows[1]).toHaveTextContent("আল-বাকারা");
    expect(rows[1]).toHaveTextContent("মাদানী · ২৮৬ আয়াত");
    expect(rows[0]).toHaveTextContent("মাক্কী · ৭ আয়াত");
    expect(within(rows[1]).getAllByText("২").length).toBeGreaterThan(0);
  });

  it("has four tabs; only the surah tab works, the others are disabled and say soon", async () => {
    await renderList();
    const group = screen.getByRole("group", { name: "কুরআনের তালিকা" });
    const surah = within(group).getByRole("button", { name: "সূরা" });
    expect(surah).toHaveAttribute("aria-pressed", "true");
    for (const name of [/পারা/, /পৃষ্ঠা/, /বুকমার্ক/]) {
      const tab = within(group).getByRole("button", { name });
      expect(tab).toBeDisabled();
      expect(tab).toHaveTextContent("শীঘ্রই");
    }
  });

  it("filters by name or number and reports the count", async () => {
    await renderList();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "বাকারা" } });
    expect(within(screen.getByTestId("surah-list")).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("১টি পাওয়া গেছে");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "৩" } });
    expect(within(screen.getByTestId("surah-list")).getAllByRole("link")[0]).toHaveAttribute("href", "/quran/3");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });
    expect(screen.getByText("কোনো সূরা পাওয়া যায়নি", { exact: false })).toBeInTheDocument();
  });

  it("renders in English", async () => {
    await renderList("en");
    expect(screen.getByRole("heading", { level: 1, name: "Al-Quran" })).toBeInTheDocument();
    expect(screen.getAllByTestId("surah-list")[0]).toHaveTextContent("Meccan · 7 Ayahs");
  });
});

describe("Last read card", () => {
  it("is hidden when nothing has been read", async () => {
    await renderList();
    expect(screen.queryByTestId("last-read-card")).toBeNull();
  });

  it("is hidden for corrupt storage", async () => {
    localStorage.setItem("rp_quran_last_read", "{broken");
    await renderList();
    expect(screen.queryByTestId("last-read-card")).toBeNull();
  });

  it("shows the surah, the ayah and a continue link to that ayah", async () => {
    writeLastRead({ surah: 2, ayah: 255 });
    await renderList();
    const card = await screen.findByTestId("last-read-card");
    expect(card).toHaveTextContent("সর্বশেষ পড়া");
    expect(within(card).getByRole("heading", { name: "আল-বাকারা" })).toBeInTheDocument();
    expect(card).toHaveTextContent("আয়াত ২৫৫");
    const link = within(card).getByRole("link", { name: /পড়া চালিয়ে যান/ });
    expect(link.getAttribute("href")).toContain("/quran/2");
    expect(link.getAttribute("href")).toContain("ayah-255");
  });

  it("falls back to the surah number when its name is not loaded", async () => {
    writeLastRead({ surah: 67, ayah: 1 });
    await renderList();
    const card = await screen.findByTestId("last-read-card");
    expect(within(card).getByRole("heading", { name: "সূরা ৬৭" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /পড়া চালিয়ে যান/ })).toHaveAttribute("href", "/quran/67");
  });
});
