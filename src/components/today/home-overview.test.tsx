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
import type { TimingData } from "@/types/database";
import type { RamadanStatus } from "@/lib/ramadan-date";
import { TIMINGS, TZ, WithIntl, at } from "@/components/prayer/test-utils";
import { HomeOverview, districtOf, hijriLabelOf, isEidOf, ramadanDayOf, type HomeOverviewProps } from "./home-overview";
import { FEATURE_TILES, PlanPreview, SupportCard, phaseCardKind } from "./home-sections";
import { SADAQAH_DISMISSED_KEY, parseDismissedAt, useSadaqahDismissal } from "./sadaqah-dismissal";
import type { DailyChecklistState } from "./use-daily-checklist";

afterEach(cleanup);
window.scrollTo = (() => {}) as typeof window.scrollTo;

const TIMING_DATA: TimingData = {
  prayerTimes: {
    fajr: "04:55",
    sunrise: "06:10",
    dhuhr: "12:10",
    asr: "16:25",
    maghrib: "18:05",
    isha: "19:20",
    sehri: "04:55",
    iftar: "18:05",
  },
  hijriDate: { day: "22", month: "Ramaḍān", year: "1448", monthAr: "رَمَضان", monthBn: "রমজান" },
  gregorianDate: "01-03-2027",
  timezone: TZ,
  location: "ঢাকা, বাংলাদেশ",
  source: "aladhan",
};

function ramadanStatus(day: number | null, extra: Partial<RamadanStatus> = {}): RamadanStatus {
  return {
    phase: day ? "ramadan" : "pre-ramadan",
    currentDay: day,
    daysUntil: day ? null : 100,
    ramadanStartGregorian: null,
    ramadanEndGregorian: null,
    hijriMonth: day ? 9 : 5,
    hijriMonthName: "Ramadan",
    hijriDay: String(day ?? 10),
    hijriYear: "1448",
    ramadanTotalDays: 30,
    ...extra,
  };
}

function checklistState(checked: Record<string, boolean> = {}): DailyChecklistState {
  return { checked, toggle: vi.fn(), isPending: false, showPrompt: false, dismissPrompt: vi.fn() };
}

async function renderInRouter(node: ReactNode, locale: "bn" | "en" = "bn") {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <WithIntl locale={locale}>{node}</WithIntl>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findAllByRole("link");
}

function renderHome(time: string, props: Partial<HomeOverviewProps> = {}, locale: "bn" | "en" = "bn") {
  const now = at(time);
  return renderInRouter(
    <HomeOverview
      status="ready"
      timings={TIMING_DATA}
      phaseTimings={TIMINGS}
      cached={false}
      ramadan={ramadanStatus(12)}
      now={now}
      frozenNow={now}
      reminders={{}}
      checklist={checklistState()}
      sadaqahDismissedAt={null}
      onDismissSadaqah={vi.fn()}
      {...props}
    />,
    locale,
  );
}

const phaseCard = () => screen.queryByTestId("phase-card");
const supportCard = () => screen.queryByTestId("support-card");

describe("phaseCardKind", () => {
  it("is the niyyah in Ramadan's Sehri phase, the iftar dua in the iftar hour, otherwise none", () => {
    expect(phaseCardKind("sehri", true)).toBe("niyyah");
    expect(phaseCardKind("sehri", false)).toBeNull();
    expect(phaseCardKind("iftar", true)).toBe("iftarDua");
    expect(phaseCardKind("iftar", false)).toBe("iftarDua");
    expect(phaseCardKind("day", true)).toBeNull();
    expect(phaseCardKind("night", true)).toBeNull();
    expect(phaseCardKind(null, true)).toBeNull();
  });
});

describe("HomeOverview phase card", () => {
  it("shows the niyyah (with its review note) before fajr in Ramadan", async () => {
    await renderHome("03:30");
    const card = phaseCard();
    expect(card).toHaveAttribute("data-kind", "niyyah");
    expect(within(card!).getByRole("heading", { name: "রোজার নিয়ত" })).toBeInTheDocument();
    expect(within(card!).getByText(/স্কলার রিভিউ সাপেক্ষে/)).toHaveClass("text-rp-gold-text");
  });

  it("shows the iftar dua with its source in the last hour before maghrib", async () => {
    await renderHome("17:30");
    const card = phaseCard();
    expect(card).toHaveAttribute("data-kind", "iftarDua");
    expect(within(card!).getByRole("heading", { name: "ইফতারের দোয়া" })).toBeInTheDocument();
    expect(within(card!).getByText(/সূত্র: আবু দাউদ ২৩৫৭/)).toHaveClass("text-rp-gold-text");
  });

  it("shows no phase card in the day or at night", async () => {
    await renderHome("13:00");
    expect(phaseCard()).toBeNull();
    cleanup();
    await renderHome("21:00");
    expect(phaseCard()).toBeNull();
  });

  it("shows no niyyah outside Ramadan", async () => {
    await renderHome("03:30", { ramadan: ramadanStatus(null) });
    expect(phaseCard()).toBeNull();
  });

  it("renders the hero, pair and prayer list with the source line and Hijri date", async () => {
    await renderHome("13:00");
    expect(screen.getByRole("region", { name: "নামাজের সময় ও কাউন্টডাউন" })).toBeInTheDocument();
    expect(screen.getByTestId("hero-source")).toHaveTextContent("উৎস: AlAdhan · করাচি পদ্ধতি, হানাফি আসর");
    expect(screen.getByTestId("hero-source")).not.toHaveTextContent("নমুনা");
    expect(screen.getByText("২২ রমজান ১৪৪৮")).toBeInTheDocument();
    expect(screen.getByTestId("pair-iftar")).toHaveTextContent("৬:০৫");
    expect(document.querySelectorAll("li[data-prayer]")).toHaveLength(5);
  });

  it("labels cached timings as sample", async () => {
    await renderHome("13:00", { cached: true });
    expect(screen.getByTestId("hero-source")).toHaveTextContent("নমুনা সময় · উৎস: যাচাই সাপেক্ষে");
  });

  it("shows a skeleton while loading and a retry on error", async () => {
    await renderHome("13:00", { status: "loading", timings: null, phaseTimings: null });
    expect(screen.getByTestId("hero-skeleton")).toBeInTheDocument();
    cleanup();
    const onRetry = vi.fn();
    await renderHome("13:00", { status: "error", timings: null, phaseTimings: null, onRetry });
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "আবার চেষ্টা করুন" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("wires the prayer bells to onToggleReminder", async () => {
    const onToggleReminder = vi.fn();
    await renderHome("13:00", { onToggleReminder, reminders: { fajr: true } });
    const fajrBell = screen.getByRole("button", { name: "ফজর রিমাইন্ডার" });
    expect(fajrBell).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(fajrBell);
    expect(onToggleReminder).toHaveBeenCalledWith("fajr", false);
  });
});

describe("HomeOverview sadaqah card", () => {
  it("shows after maghrib, away from prayer times", async () => {
    await renderHome("20:00");
    expect(supportCard()).toBeInTheDocument();
    expect(within(supportCard()!).getByRole("link", { name: "অংশ নিন →" })).toHaveAttribute("href", "/support");
  });

  it("is hidden in the day (before the last ten), in Sehri and within 15 minutes of a prayer", async () => {
    await renderHome("13:00");
    expect(supportCard()).toBeNull();
    cleanup();
    await renderHome("03:30", { ramadan: ramadanStatus(25) });
    expect(supportCard()).toBeNull();
    cleanup();
    await renderHome("19:30");
    expect(supportCard()).toBeNull();
  });

  it("shows in the day during the last ten nights, with the last-ten title", async () => {
    await renderHome("13:00", { ramadan: ramadanStatus(25) });
    expect(within(supportCard()!).getByRole("heading")).toHaveTextContent("শেষ দশকে সাদাকায়ে জারিয়া");
  });

  it("shows on Eid", async () => {
    await renderHome("14:00", {
      ramadan: ramadanStatus(null, { phase: "post-ramadan", hijriMonth: 10, hijriDay: "1" }),
    });
    expect(supportCard()).toBeInTheDocument();
  });

  it("stays hidden for a day after a dismissal and calls onDismiss from its button", async () => {
    await renderHome("20:00", { sadaqahDismissedAt: at("19:00") });
    expect(supportCard()).toBeNull();
    cleanup();
    const onDismissSadaqah = vi.fn();
    await renderHome("20:00", { onDismissSadaqah });
    fireEvent.click(screen.getByRole("button", { name: "সাদাকার কার্ডটি এখন লুকান" }));
    expect(onDismissSadaqah).toHaveBeenCalledTimes(1);
    expect(supportCard()).toBeNull();
  });
});

describe("sadaqah dismissal storage", () => {
  beforeEach(() => localStorage.clear());

  function Harness() {
    const { dismissedAt, dismiss } = useSadaqahDismissal();
    return (
      <div>
        <span data-testid="dismissed">{dismissedAt ? dismissedAt.toISOString() : "none"}</span>
        <SupportCard lastTen={false} onDismiss={() => dismiss(new Date("2027-03-01T14:00:00Z"))} />
      </div>
    );
  }

  it("stores dismissedAt in localStorage and re-reads it", async () => {
    await renderInRouter(<Harness />);
    expect(screen.getByTestId("dismissed")).toHaveTextContent("none");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "সাদাকার কার্ডটি এখন লুকান" }));
    });
    expect(localStorage.getItem(SADAQAH_DISMISSED_KEY)).toBe("2027-03-01T14:00:00.000Z");
    expect(screen.getByTestId("dismissed")).toHaveTextContent("2027-03-01T14:00:00.000Z");
  });

  it("ignores missing or invalid stored values", () => {
    expect(parseDismissedAt(null)).toBeNull();
    expect(parseDismissedAt("not a date")).toBeNull();
    expect(parseDismissedAt("2027-03-01T14:00:00.000Z")?.getTime()).toBe(Date.UTC(2027, 2, 1, 14));
  });
});

describe("feature tiles", () => {
  it("link to Quran, Duas, Tasbih and Zakat under the companions header", async () => {
    await renderHome("13:00");
    const section = screen.getByRole("region", { name: "রমজানের সঙ্গী" });
    const links = within(section).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/quran", "/duas", "/tasbih", "/zakat"]);
    expect(links.map((a) => a.textContent)).toEqual(["কুরআন", "দোয়া", "তাসবিহ", "যাকাত"]);
    expect(FEATURE_TILES).toHaveLength(4);
  });
});

describe("today's plan preview", () => {
  it("shows the first three checklist items with their state, the count and an 'all' link", async () => {
    const state = checklistState({ morningDhikr: true, charity: true });
    await renderInRouter(<PlanPreview state={state} />);
    const section = screen.getByRole("region", { name: /আজকের পরিকল্পনা/ });
    expect(within(section).getByRole("heading")).toHaveTextContent("আজকের পরিকল্পনা · ২/৬");
    const boxes = within(section).getAllByRole("checkbox");
    expect(boxes.map((b) => b.textContent)).toEqual(["সকালের যিকর", "সন্ধ্যার যিকর", "৭০ বার ইস্তিগফার"]);
    expect(boxes.map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(within(section).getByRole("link", { name: "আজকের সব পরিকল্পনা দেখুন" })).toHaveAttribute("href", "/plan");
    fireEvent.click(boxes[1]);
    expect(state.toggle).toHaveBeenCalledWith("eveningDhikr");
  });

  it("uses English labels in en", async () => {
    await renderInRouter(<PlanPreview state={checklistState()} />, "en");
    expect(screen.getByRole("heading")).toHaveTextContent("Today's plan · 0/6");
  });
});

describe("home helpers", () => {
  it("ramadanDayOf and isEidOf", () => {
    expect(ramadanDayOf(ramadanStatus(12))).toBe(12);
    expect(ramadanDayOf(ramadanStatus(null))).toBeNull();
    expect(ramadanDayOf(null)).toBeNull();
    expect(isEidOf(ramadanStatus(null, { hijriMonth: 10, hijriDay: "2" }))).toBe(true);
    expect(isEidOf(ramadanStatus(null, { hijriMonth: 10, hijriDay: "4" }))).toBe(false);
    expect(isEidOf(ramadanStatus(null, { hijriMonth: 12, hijriDay: "10" }))).toBe(true);
    expect(isEidOf(ramadanStatus(29))).toBe(false);
  });

  it("hijriLabelOf and districtOf", () => {
    const fmt = (v: Record<string, string>) => `${v.day} ${v.month} ${v.year}`;
    expect(hijriLabelOf(TIMING_DATA, "bn", fmt)).toBe("২২ রমজান ১৪৪৮");
    expect(hijriLabelOf(TIMING_DATA, "en", fmt)).toBe("22 Ramadan 1448");
    expect(hijriLabelOf({ ...TIMING_DATA, hijriDate: { ...TIMING_DATA.hijriDate, day: "" } }, "bn", fmt)).toBeUndefined();
    expect(districtOf("ঢাকা, বাংলাদেশ")).toBe("ঢাকা");
    expect(districtOf("Bangkok")).toBe("Bangkok");
  });
});
