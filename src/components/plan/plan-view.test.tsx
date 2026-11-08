// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { TimetableDay } from "@/lib/ramadan-timetable";
import { zonedTime } from "@/lib/prayer-phase";
import { WithIntl } from "@/components/prayer/test-utils";
import { ChecklistCards } from "./checklist";
import { NightHero, OddNightsCard, QADR_DUA_ARABIC, QadrDuaCard } from "./night-view";
import { nightTimes, oddNightRows } from "./plan-logic";
import { ProgressCard } from "./progress-card";

afterEach(cleanup);

const TZ = "Asia/Dhaka";
const DAYS: TimetableDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2027, 1, 9 + i));
  return {
    day: i + 1,
    gregorianDate: `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-2027`,
    weekday: "Sat",
    sehri: "04:48",
    iftar: "18:06",
    fajr: "04:58",
    maghrib: "18:06",
  };
});

describe("ProgressCard", () => {
  it("shows done/total in Bengali digits, the encouraging line and Quran progress", () => {
    render(
      <WithIntl>
        <ProgressCard done={3} total={7} quranPara={12} streak={12} />
      </WithIntl>,
    );
    expect(screen.getByRole("img", { name: "৭টির মধ্যে ৩টি আমল হয়েছে" })).toHaveTextContent("৩/৭");
    expect(screen.getByTestId("plan-progress-copy")).toHaveTextContent("আলহামদুলিল্লাহ, ভালো চলছে");
    expect(screen.getByText("কুরআন ১২/৩০ পারা · টানা ১২ দিন")).toBeInTheDocument();
  });

  it("starts gently and celebrates the end; a neutral line without Quran data", () => {
    const { rerender } = render(
      <WithIntl>
        <ProgressCard done={0} total={4} quranPara={null} streak={0} />
      </WithIntl>,
    );
    expect(screen.getByTestId("plan-progress-copy")).toHaveTextContent("বিসমিল্লাহ, শুরু করা যাক");
    expect(screen.getByText("ছোট আমলও গুরুত্বপূর্ণ")).toBeInTheDocument();
    rerender(
      <WithIntl locale="en">
        <ProgressCard done={4} total={4} quranPara={3} streak={0} />
      </WithIntl>,
    );
    expect(screen.getByTestId("plan-progress-copy")).toHaveTextContent("Alhamdulillah, all of today's amal is done");
    expect(screen.getByText("Quran 3/30 juz")).toBeInTheDocument();
  });

  it("keeps white text at >= 4.5:1 on the lightest gradient stop", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../styles/globals.css"), "utf8");
    const hex = /--rp-teal-600:\s*(#[0-9A-Fa-f]{6})/.exec(css)?.[1];
    expect(hex).toBeDefined();
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(1.05 / (lum(hex!) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ChecklistCards", () => {
  it("renders round checkboxes with title and meta, and toggles", () => {
    const onToggle = vi.fn();
    render(
      <WithIntl>
        <ChecklistCards
          items={[
            { id: "a", title: "সেহরি ও নিয়ত", done: true, meta: "৪:৩০" },
            { id: "b", title: "তারাবি", done: false },
          ]}
          onToggle={onToggle}
        />
      </WithIntl>,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[0]).toHaveAttribute("aria-checked", "true");
    expect(boxes[0]).toHaveTextContent("৪:৩০");
    fireEvent.click(boxes[1]);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }), true);
  });

  it("locks a row while its request is in flight and offers a 48px edit button", () => {
    const onEdit = vi.fn();
    render(
      <WithIntl>
        <ChecklistCards
          items={[
            { id: "a", title: "সেহরি ও নিয়ত", done: false },
            { id: "b", title: "তারাবি", done: false },
          ]}
          onToggle={() => {}}
          onEdit={onEdit}
          pending={new Set(["a"])}
        />
      </WithIntl>,
    );
    const [a, b] = screen.getAllByRole("checkbox");
    expect(a).toBeDisabled();
    expect(a).toHaveAttribute("aria-busy", "true");
    expect(b).toBeEnabled();
    const edit = screen.getByRole("button", { name: "তারাবি সম্পাদনা করুন" });
    expect(edit).toHaveClass("w-12");
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });
});

describe("last ten nights", () => {
  it("highlights tonight (27th) among the five odd-night rows and mutes the past", () => {
    render(
      <WithIntl>
        <OddNightsCard rows={oddNightRows(DAYS, 27)} />
      </WithIntl>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    const tonight = items[3];
    expect(tonight).toHaveAttribute("data-night", "27");
    expect(tonight).toHaveAttribute("aria-current", "date");
    expect(tonight).toHaveClass("bg-rp-gold-tint");
    expect(within(tonight).getByText("বেজোড় রাত · লাইলাতুল কদরের সন্ধান")).toBeInTheDocument();
    // Roza 26 (the evening the 27th night begins) is 6 March 2027.
    expect(within(tonight).getByText(/৬ মার্চ/)).toBeInTheDocument();
    expect(items[0]).toHaveClass("text-rp-muted");
    expect(items[4]).toHaveAttribute("data-state", "upcoming");
  });

  it("shows the suggested tahajjud time and the sehri end in the night hero", () => {
    const times = nightTimes(DAYS, 27, TZ)!;
    render(
      <WithIntl>
        <NightHero
          times={times}
          now={zonedTime("2027-03-06", "22:00", TZ)!}
          night={27}
          timeZone={TZ}
          location="ঢাকা"
          hijriYear="1448"
        />
      </WithIntl>,
    );
    const hero = screen.getByTestId("night-hero");
    expect(within(hero).getByText("আজ রাতের তাহাজ্জুদ")).toBeInTheDocument();
    // 18:06 -> 04:58 = 10h52m; two thirds = 7h15m -> 01:21.
    expect(screen.getByTestId("tahajjud-time")).toHaveTextContent("১:২১");
    expect(within(hero).getByText("সেহরি শেষ ভোর ৪:৪৮")).toBeInTheDocument();
    expect(within(hero).getByText("২৭ রমজান ১৪৪৮")).toBeInTheDocument();
    expect(within(hero).getByText(/প্রস্তাবিত: রাতের শেষ তৃতীয়াংশ/)).toBeInTheDocument();
  });
});

describe("QadrDuaCard", () => {
  it("shows the Arabic, transliteration, meaning and source", () => {
    render(
      <WithIntl>
        <QadrDuaCard />
      </WithIntl>,
    );
    const card = screen.getByTestId("qadr-dua");
    expect(within(card).getByText(QADR_DUA_ARABIC)).toHaveAttribute("lang", "ar");
    expect(within(card).getByText(/আল্লাহুম্মা ইন্নাকা/)).toBeInTheDocument();
    expect(within(card).getByText(/ক্ষমা করুন/)).toBeInTheDocument();
    expect(within(card).getByText("সূত্র: তিরমিজি ৩৫১৩")).toBeInTheDocument();
  });
});
