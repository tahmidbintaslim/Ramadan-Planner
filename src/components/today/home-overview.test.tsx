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
import type { PlanPreviewRow, PlanPreviewState } from "./home-sections";

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

function row(id: string, title: string, done: boolean, window: PlanPreviewRow["window"]): PlanPreviewRow {
  return { id, kind: "task", title, done, window, scopeISO: "2027-03-01" };
}

function planState(rows: PlanPreviewRow[] = [], extra: Partial<PlanPreviewState> = {}): PlanPreviewState {
  return {
    rows,
    done: rows.filter((r) => r.done).length,
    total: rows.length,
    ready: true,
    pending: new Set(),
    toggleRow: vi.fn(),
    ...extra,
  };
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
      plan={planState()}
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
  const kind = (time: string, ramadan = true) => {
    const now = at(time);
    const phase =
      now < TIMINGS.fajr ? "sehri" : now < new Date(TIMINGS.maghrib.getTime() - 3_600_000) ? "day" : now < TIMINGS.maghrib ? "iftar" : "night";
    return phaseCardKind(now, phase, TIMINGS, ramadan);
  };

  it("is the niyyah in Ramadan's Sehri phase", () => {
    expect(kind("03:30")).toBe("niyyah");
    expect(kind("03:30", false)).toBeNull();
  });

  it("is the iftar dua from maghrib − 60 min until maghrib + 45 min, in Ramadan only", () => {
    // maghrib 18:05
    expect(kind("17:04")).toBeNull();
    expect(kind("17:05")).toBe("iftarDua");
    expect(kind("18:05")).toBe("iftarDua");
    expect(kind("18:49")).toBe("iftarDua");
    expect(kind("18:50")).toBeNull();
    expect(kind("17:30", false)).toBeNull();
  });

  it("is none in the day, late night, or without a phase", () => {
    expect(kind("13:00")).toBeNull();
    expect(kind("21:00")).toBeNull();
    expect(phaseCardKind(at("03:30"), null, TIMINGS, true)).toBeNull();
  });
});

describe("HomeOverview phase card", () => {
  it("shows the niyyah with the reviewed wording before fajr in Ramadan", async () => {
    await renderHome("03:30");
    const card = phaseCard();
    expect(card).toHaveAttribute("data-kind", "niyyah");
    expect(within(card!).getByRole("heading", { name: "রোজার নিয়ত" })).toBeInTheDocument();
    expect(within(card!).getByText("আমি আগামীকাল রমজান মাসের রোজা রাখার নিয়ত করছি")).toBeInTheDocument();
    expect(
      within(card!).getByText("নিয়ত অন্তরের সংকল্প; মুখে বলা আবশ্যক নয় · স্কলার রিভিউ সাপেক্ষে"),
    ).toHaveClass("text-rp-gold-text");
  });

  it("shows the iftar dua with its caption before maghrib and until 45 minutes after", async () => {
    await renderHome("17:30");
    let card = phaseCard();
    expect(card).toHaveAttribute("data-kind", "iftarDua");
    expect(within(card!).getByRole("heading", { name: "ইফতারের দোয়া" })).toBeInTheDocument();
    expect(within(card!).getByText("সূত্র: আবু দাউদ ২৩৫৭")).toHaveClass("text-rp-gold-text");
    // Arabic first, in the Arabic face, then the transliteration and meaning (the /duas order).
    expect(within(card!).getByText(/ذَهَبَ الظَّمَأُ/)).toHaveClass("font-arabic");
    cleanup();
    await renderHome("18:30");
    card = phaseCard();
    expect(card).toHaveAttribute("data-kind", "iftarDua");
    cleanup();
    await renderHome("18:55");
    expect(phaseCard()).toBeNull();
  });

  it("uses the English caption in en", async () => {
    await renderHome("17:30", {}, "en");
    expect(within(phaseCard()!).getByText("Source: Abu Dawud 2357")).toBeInTheDocument();
  });

  it("shows no phase card in the day or late at night", async () => {
    await renderHome("13:00");
    expect(phaseCard()).toBeNull();
    cleanup();
    await renderHome("21:00");
    expect(phaseCard()).toBeNull();
  });

  it("shows no niyyah or iftar dua outside Ramadan", async () => {
    await renderHome("03:30", { ramadan: ramadanStatus(null) });
    expect(phaseCard()).toBeNull();
    cleanup();
    await renderHome("17:30", { ramadan: ramadanStatus(null) });
    expect(phaseCard()).toBeNull();
  });

  it("after Isha in Ramadan the pair shows tomorrow's sehri and iftar, labelled", async () => {
    const tomorrow = {
      fajr: new Date(TIMINGS.nextFajr.getTime()),
      sehriEnd: new Date(TIMINGS.nextFajr.getTime() - 5 * 60_000),
      maghrib: new Date(TIMINGS.maghrib.getTime() + 24 * 3_600_000 + 60_000),
    };
    await renderHome("21:00", { tomorrowTimings: tomorrow });
    expect(screen.getByTestId("pair-day")).toHaveTextContent("আগামীকাল");
    expect(screen.getByTestId("pair-sehri")).toHaveTextContent("৪:৪৯");
    expect(screen.getByTestId("pair-iftar")).toHaveTextContent("৬:০৬");
    cleanup();
    // Before Isha, or outside Ramadan: today's times, no label.
    await renderHome("19:00", { tomorrowTimings: tomorrow });
    expect(screen.queryByTestId("pair-day")).toBeNull();
    expect(screen.getByTestId("pair-iftar")).toHaveTextContent("৬:০৫");
    cleanup();
    await renderHome("21:00", { tomorrowTimings: tomorrow, ramadan: ramadanStatus(null) });
    expect(screen.queryByTestId("pair-day")).toBeNull();
  });
});

describe("HomeOverview core", () => {

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
    const fajrBell = screen.getByRole("button", { name: "ফজর নামাজের রিমাইন্ডার" });
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
    expect(links.map((a) => a.textContent)).toEqual(["কুরআন", "দোয়া ও যিকির", "তাসবিহ", "যাকাত হিসাব"]);
    expect(FEATURE_TILES).toHaveLength(4);
  });
});

describe("today's plan preview (a small link; tracking lives on /plan)", () => {
  const rows = [
    row("a", "কুরআন পড়ুন", true, "dhuhrToIftar"),
    row("b", "তারাবি", false, "afterIftar"),
    row("c", "সেহরি খান", false, "sehriToDhuhr"),
    row("d", "ফজর", true, "sehriToDhuhr"),
  ];

  it("is one link to /plan with the /plan count and the next open deed, no checkboxes", async () => {
    await renderInRouter(<PlanPreview state={planState(rows)} />);
    const section = screen.getByTestId("plan-preview");
    expect(within(section).getByRole("heading")).toHaveTextContent("আজকের আমল · ২/৪");
    expect(within(section).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(section).getByRole("link", { name: "আজকের আমল খুলুন" })).toHaveAttribute("href", "/plan");
    expect(screen.getByTestId("plan-preview-next")).toHaveTextContent("এরপর: সেহরি খান");
  });

  it("an empty plan shows ০/০ and invites a choice, like /plan", async () => {
    await renderInRouter(<PlanPreview state={planState()} />);
    expect(screen.getByRole("heading")).toHaveTextContent("আজকের আমল · ০/০");
    expect(screen.getByTestId("plan-preview-next")).toHaveTextContent("আজকের আমল বেছে নিন");
  });

  it("a failed load shows an error and no ০/০ count", async () => {
    await renderInRouter(<PlanPreview state={planState([], { error: true })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("আজকের পরিকল্পনা এখন লোড বা সংরক্ষণ করা যায়নি।");
    expect(screen.getByRole("heading")).toHaveTextContent(/^আজকের আমল$/);
  });

  it("shows no count before the list is known, and English labels in en", async () => {
    await renderInRouter(<PlanPreview state={planState(rows, { ready: false })} />, "en");
    expect(screen.getByRole("heading")).toHaveTextContent(/^Today's amal$/);
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
