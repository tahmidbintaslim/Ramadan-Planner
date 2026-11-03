// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { PrayerHero, nextAnnouncement, type PrayerHeroProps } from "./prayer-hero";
import { PRAYER_TICK_MS } from "./use-prayer-phase";
import { TIMINGS, TZ, WithIntl, at } from "./test-utils";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderHero(props: Partial<PrayerHeroProps> = {}, locale: "bn" | "en" = "bn") {
  return render(
    <WithIntl locale={locale}>
      <PrayerHero
        timings={TIMINGS}
        timeZone={TZ}
        district="ঢাকা"
        hijriLabel="২২ রমযান ১৪৪৮"
        source="ইসলামিক ফাউন্ডেশন"
        {...props}
      />
    </WithIntl>,
  );
}

const hero = () => screen.getByRole("region");

describe("PrayerHero phases (bn)", () => {
  it("sehri: label, sehri-end time, remaining, night sky with crescent", () => {
    renderHero({ now: at("03:55") });
    expect(hero().dataset.phase).toBe("sehri");
    expect(hero()).toHaveTextContent("সেহরি শেষ");
    expect(hero()).toHaveTextContent("৪:৫৫");
    expect(hero()).toHaveTextContent("আর ১ ঘণ্টা");
    expect(hero().style.backgroundImage).toContain("--rp-hero-sehri");
    expect(screen.getByTestId("hero-crescent")).toBeTruthy();
  });

  it("day: next prayer label and time, no crescent", () => {
    renderHero({ now: at("13:00") });
    expect(hero().dataset.phase).toBe("day");
    expect(hero()).toHaveTextContent("পরবর্তী · আসর");
    expect(hero()).toHaveTextContent("৪:২৫");
    expect(hero()).toHaveTextContent("আর ৩ ঘণ্টা ২৫ মিনিট");
    expect(hero().style.backgroundImage).toContain("--rp-hero-day");
    expect(screen.queryByTestId("hero-crescent")).toBeNull();
  });

  it("iftar: iftar label, maghrib time, white arc", () => {
    renderHero({ now: at("17:35") });
    expect(hero().dataset.phase).toBe("iftar");
    expect(hero()).toHaveTextContent("ইফতার");
    expect(hero()).toHaveTextContent("৬:০৫");
    expect(hero()).toHaveTextContent("আর ৩০ মিনিট");
    expect(screen.getByTestId("hero-ring-progress").getAttribute("stroke")).toBe("white");
    expect(screen.queryByTestId("hero-crescent")).toBeNull();
  });

  it("night before isha: isha label and time", () => {
    renderHero({ now: at("18:30") });
    expect(hero().dataset.phase).toBe("night");
    expect(hero()).toHaveTextContent("ইশা");
    expect(hero()).toHaveTextContent("৭:২০");
    expect(hero()).toHaveTextContent("আর ৫০ মিনিট");
    expect(screen.getByTestId("hero-crescent")).toBeTruthy();
  });

  it("night after isha: next fajr tomorrow, or sehri end in Ramadan", () => {
    renderHero({ now: at("21:00") });
    expect(hero()).toHaveTextContent("পরবর্তী · ফজর");
    expect(hero()).toHaveTextContent("৪:৫৪");
    expect(hero()).toHaveTextContent("আর ৭ ঘণ্টা ৫৪ মিনিট");
    cleanup();
    renderHero({ now: at("21:00"), ramadan: true });
    expect(hero()).toHaveTextContent("সেহরি শেষ");
    expect(hero()).toHaveTextContent("৪:৫৪");
  });

  it("night after isha in Ramadan: tomorrow's sehri end time, not fajr", () => {
    const withSehri = { ...TIMINGS, nextSehriEnd: new Date(TIMINGS.nextFajr.getTime() - 5 * 60_000) };
    renderHero({ now: at("21:00"), ramadan: true, timings: withSehri });
    expect(hero()).toHaveTextContent("সেহরি শেষ");
    expect(hero()).toHaveTextContent("৪:৪৯");
    expect(hero()).toHaveTextContent("আর ৭ ঘণ্টা ৪৯ মিনিট");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", expect.stringContaining("সেহরি"));
    cleanup();
    // Outside Ramadan the hero keeps "next · Fajr" and its time.
    renderHero({ now: at("21:00"), timings: withSehri });
    expect(hero()).toHaveTextContent("পরবর্তী · ফজর");
    expect(hero()).toHaveTextContent("৪:৫৪");
    expect(hero()).toHaveTextContent("আর ৭ ঘণ্টা ৫৪ মিনিট");
  });

  it("top row and source line (sample labelled)", () => {
    renderHero({ now: at("13:00"), sample: true });
    expect(hero()).toHaveTextContent("ঢাকা");
    expect(hero()).toHaveTextContent("২২ রমযান ১৪৪৮");
    expect(hero()).toHaveTextContent("নমুনা সময় · উৎস: ইসলামিক ফাউন্ডেশন");
    cleanup();
    renderHero({ now: at("13:00") });
    expect(hero()).toHaveTextContent("উৎস: ইসলামিক ফাউন্ডেশন");
    expect(hero()).not.toHaveTextContent("নমুনা");
  });

  it("uses Bengali digits only in bn", () => {
    renderHero({ now: at("13:00") });
    expect(hero().textContent).not.toMatch(/[0-9]/);
  });
});

describe("PrayerHero (en)", () => {
  it("renders English labels with Latin digits", () => {
    renderHero({ now: at("13:00"), district: "Dhaka", hijriLabel: "22 Ramadan 1448", source: "IFB" }, "en");
    expect(hero()).toHaveTextContent("Next · Asr");
    expect(hero()).toHaveTextContent("4:25");
    expect(hero()).toHaveTextContent("3h 25m left");
    expect(hero()).toHaveTextContent("Source: IFB");
  });
});

describe("PrayerHero ring", () => {
  it("arc length follows progress and has no transition under reduced motion", () => {
    renderHero({ now: at("13:00") });
    const arc = screen.getByTestId("hero-ring-progress");
    const c = Number(arc.getAttribute("stroke-dasharray"));
    const offset = Number(arc.getAttribute("stroke-dashoffset"));
    expect(c).toBeGreaterThan(0);
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThan(c);
    expect(arc.getAttribute("class")).toContain("motion-reduce:transition-none");
    const bar = screen.getByRole("progressbar");
    expect(Number(bar.getAttribute("aria-valuenow"))).toBe(Math.round((1 - offset / c) * 100));
  });
});

describe("PrayerHero live clock", () => {
  it("ticks every 30 s and announces in the tick that enters a new minute", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(at("13:00:15"));
    renderHero();
    const live = screen.getByTestId("hero-live");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live).toHaveTextContent("আর ৩ ঘণ্টা ২৫ মিনিট");

    act(() => vi.advanceTimersByTime(PRAYER_TICK_MS)); // 13:00:45, same minute, same text
    expect(live).toHaveTextContent("আর ৩ ঘণ্টা ২৫ মিনিট");

    // Jittered tick just into the next minute: announced now, not one tick later.
    act(() => vi.advanceTimersByTime(PRAYER_TICK_MS + 50)); // 13:01:15.05
    expect(hero()).toHaveTextContent("আর ৩ ঘণ্টা ২৪ মিনিট");
    expect(live).toHaveTextContent("আর ৩ ঘণ্টা ২৪ মিনিট");
  });

  it("switching from a frozen to a live clock shows the current time at once", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(at("17:35:00"));
    const { rerender } = renderHero({ now: at("13:00") });
    expect(hero().dataset.phase).toBe("day");
    rerender(
      <WithIntl>
        <PrayerHero timings={TIMINGS} timeZone={TZ} district="ঢাকা" source="IFB" />
      </WithIntl>,
    );
    expect(hero().dataset.phase).toBe("iftar");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("pauses while the document is hidden and clears its timer on unmount", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(at("13:00:00"));
    let hidden = false;
    const spy = vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    const { unmount } = renderHero();
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10 * 60_000)); // clock moves, the UI does not
    expect(hero()).toHaveTextContent("আর ৩ ঘণ্টা ২৫ মিনিট");

    act(() => {
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hero()).toHaveTextContent("আর ৩ ঘণ্টা ১৫ মিনিট");
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    spy.mockRestore();
  });
});

describe("nextAnnouncement (live-region gate)", () => {
  const minute = (d: Date) => Math.floor(d.getTime() / 60_000);
  const prev = { text: "a", minute: minute(at("13:00:59")) };
  it("holds a changed text within the same clock minute", () => {
    expect(nextAnnouncement(prev, "b", at("13:00:59").getTime() + 900)).toBe(prev);
  });
  it("announces a changed text as soon as a new minute starts, even < 60 s later", () => {
    expect(nextAnnouncement(prev, "b", at("13:01:00").getTime() + 100)).toEqual({
      text: "b",
      minute: minute(at("13:01")),
    });
  });
  it("keeps an unchanged text", () => {
    expect(nextAnnouncement(prev, "a", at("13:05").getTime())).toBe(prev);
  });
});

describe("PrayerHero a11y labels", () => {
  it("progressbar has a spoken value and the location pill a labelled prefix", () => {
    renderHero({ now: at("17:35") }); // 30 of the 60 iftar minutes
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "ইফতার পর্যন্ত ৫০% সময় পেরিয়েছে");
    expect(screen.getByText("অবস্থান: ঢাকা")).toHaveClass("sr-only");
    cleanup();
    renderHero({ now: at("13:00"), district: "Dhaka" }, "en");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toMatch(
      /^\d+% of the time until Asr has passed$/,
    );
    expect(screen.getByText("Location: Dhaka")).toBeInTheDocument();
  });
});

describe("PrayerHero hydration", () => {
  it("hydrates without a mismatch across a phase boundary when given initialNow", async () => {
    const tree = (
      <WithIntl>
        <PrayerHero timings={TIMINGS} timeZone={TZ} district="ঢাকা" source="IFB" initialNow={at("17:04:30")} />
      </WithIntl>
    );
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(at("17:04:30"));
    const html = renderToString(tree); // server: day phase, just before the iftar window
    expect(html).toContain('data-phase="day"');

    vi.setSystemTime(at("17:06:00")); // the client hydrates after the boundary
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => errors.push(e) });
    });
    expect(errors).toEqual([]);
    expect(container.querySelector("section")?.dataset.phase).toBe("iftar"); // live clock took over
    act(() => root?.unmount());
    container.remove();
    consoleError.mockRestore();
  });
});
