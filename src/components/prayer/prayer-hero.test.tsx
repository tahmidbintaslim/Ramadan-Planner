// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrayerHero, type PrayerHeroProps } from "./prayer-hero";
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
  it("ticks every 30 s but announces at most once a minute", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(at("13:00:45"));
    renderHero();
    const live = screen.getByTestId("hero-live");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live).toHaveTextContent("আর ৩ ঘণ্টা ২৫ মিনিট");

    act(() => vi.advanceTimersByTime(PRAYER_TICK_MS)); // 13:01:15
    expect(hero()).toHaveTextContent("আর ৩ ঘণ্টা ২৪ মিনিট");
    expect(live).toHaveTextContent("আর ৩ ঘণ্টা ২৫ মিনিট");

    act(() => vi.advanceTimersByTime(PRAYER_TICK_MS)); // 13:01:45
    expect(live).toHaveTextContent("আর ৩ ঘণ্টা ২৪ মিনিট");
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
