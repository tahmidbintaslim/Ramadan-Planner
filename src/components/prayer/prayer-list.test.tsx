// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { PrayerList, prayerRowStates, type PrayerListProps } from "./prayer-list";
import { SehriIftarPair } from "./sehri-iftar-pair";
import { TIMINGS, TZ, WithIntl, at } from "./test-utils";

afterEach(cleanup);
// The router restores scroll on load; jsdom does not implement scrollTo.
window.scrollTo = (() => {}) as typeof window.scrollTo;

/** Link needs a router; mount the node as the index route. */
async function renderInRouter(node: ReactNode) {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => node });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("list");
}

function renderList(props: Partial<PrayerListProps> = {}, locale: "bn" | "en" = "bn") {
  return renderInRouter(
    <WithIntl locale={locale}>
      <PrayerList timings={TIMINGS} timeZone={TZ} now={at("13:00")} {...props} />
    </WithIntl>,
  );
}

const row = (key: string) => document.querySelector(`li[data-prayer="${key}"]`) as HTMLElement;

describe("prayerRowStates", () => {
  it("marks passed prayers past and the first one ahead next", () => {
    expect(prayerRowStates(at("13:00"), TIMINGS)).toEqual({
      fajr: "past",
      dhuhr: "past",
      asr: "next",
      maghrib: "upcoming",
      isha: "upcoming",
    });
    expect(prayerRowStates(at("03:00"), TIMINGS).fajr).toBe("next");
    expect(Object.values(prayerRowStates(at("21:00"), TIMINGS))).toEqual(Array(5).fill("past"));
  });
});

describe("PrayerList", () => {
  it("renders the header, five rows with Bengali times, and the reminders link", async () => {
    await renderList();
    expect(screen.getByRole("heading", { name: "আজকের নামাজ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "রিমাইন্ডার" })).toHaveAttribute("href", "/reminders");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(row("fajr")).toHaveTextContent("ফজর");
    expect(row("fajr")).toHaveTextContent("৪:৫৫");
    expect(row("maghrib")).toHaveTextContent("৬:০৫");
    expect(screen.getByRole("list").textContent).not.toMatch(/[0-9]/);
  });

  it("styles past rows muted and the next row tinted with a পরবর্তী badge", async () => {
    await renderList();
    expect(row("dhuhr").dataset.state).toBe("past");
    expect(row("dhuhr").className).toContain("text-rp-muted");
    expect(row("dhuhr").querySelector("svg")?.getAttribute("class")).toContain("text-rp-strong");

    const next = row("asr");
    expect(next.dataset.state).toBe("next");
    expect(next).toHaveAttribute("aria-current", "time");
    expect(next.className).toContain("bg-rp-accent-tint");
    expect(next.className).toContain("text-rp-accent");
    const badge = within(next).getByText("পরবর্তী");
    expect(badge.className).toContain("bg-rp-live");
    expect(badge.className).toContain("text-rp-on-live");
    expect(document.querySelectorAll('[data-state="next"]')).toHaveLength(1);
  });

  it("without a toggle handler each bell links to /reminders", async () => {
    await renderList();
    const bell = screen.getByRole("link", { name: "আসর রিমাইন্ডার সেট করুন" });
    expect(bell).toHaveAttribute("href", "/reminders");
  });

  it("with a toggle handler the bell is a pressed/unpressed toggle", async () => {
    const onToggle = vi.fn();
    await renderList({ reminders: { asr: true }, onToggleReminder: onToggle });
    const asr = screen.getByRole("button", { name: "আসর রিমাইন্ডার" });
    const isha = screen.getByRole("button", { name: "ইশা রিমাইন্ডার" });
    expect(asr).toHaveAttribute("aria-pressed", "true");
    expect(isha).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(asr);
    expect(onToggle).toHaveBeenCalledWith("asr", false);
    fireEvent.click(isha);
    expect(onToggle).toHaveBeenCalledWith("isha", true);
  });

  it("renders English names and Latin digits in en", async () => {
    await renderList({}, "en");
    expect(screen.getByRole("heading", { name: "Today's prayers" })).toBeInTheDocument();
    expect(row("asr")).toHaveTextContent("Asr");
    expect(row("asr")).toHaveTextContent("4:25");
    expect(within(row("asr")).getByText("Next")).toBeInTheDocument();
  });
});

describe("SehriIftarPair", () => {
  it("shows sehri end and iftar with Bengali digits", () => {
    render(
      <WithIntl>
        <SehriIftarPair timings={TIMINGS} timeZone={TZ} />
      </WithIntl>,
    );
    expect(screen.getByText("সেহরি শেষ")).toBeInTheDocument();
    expect(screen.getByText("ইফতার")).toBeInTheDocument();
    expect(screen.getByTestId("pair-sehri")).toHaveTextContent("৪:৫৫");
    expect(screen.getByTestId("pair-iftar")).toHaveTextContent("৬:০৫");
  });

  it("prefers a distinct sehri end and uses Latin digits in en", () => {
    render(
      <WithIntl locale="en">
        <SehriIftarPair timings={{ ...TIMINGS, sehriEnd: at("04:45") }} timeZone={TZ} />
      </WithIntl>,
    );
    expect(screen.getByText("Sehri ends")).toBeInTheDocument();
    expect(screen.getByTestId("pair-sehri")).toHaveTextContent("4:45");
    expect(screen.getByTestId("pair-iftar")).toHaveTextContent("6:05");
  });
});
