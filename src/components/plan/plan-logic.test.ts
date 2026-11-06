import { describe, expect, it } from "vitest";
import type { TimetableDay } from "@/lib/ramadan-timetable";
import { zonedTime } from "@/lib/prayer-phase";
import { parseItemNotes, pruneItemNotes } from "./plan-item-meta";
import {
  DAY_DEFAULTS,
  NIGHT_DEFAULTS,
  bnOrdinal,
  buildPlanRows,
  nightEveningISO,
  planDisplayOrder,
  currentNight,
  defaultPlanView,
  doneForDay,
  goalDoneForDay,
  groupByWindow,
  nightsViewAvailable,
  tickScopeISO,
  lastTenVisible,
  matchDefaultKey,
  nextPara,
  nightProgress,
  nightTimes,
  oddNightRows,
  paraFromText,
  progressCopy,
  quranStreak,
  tahajjudTime,
  windowFromTitle,
  type PlanWindow,
} from "./plan-logic";

const TZ = "Asia/Dhaka";
const at = (iso: string, hhmm: string) => zonedTime(iso, hhmm, TZ) as Date;

/** Roza N on 2027-02-(N+8) (roza 1 = 9 Feb 2027), maghrib 18:00, fajr 05:00, sehri 04:50. */
const DAYS: TimetableDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2027, 1, 9 + i));
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return {
    day: i + 1,
    gregorianDate: `${dd}-${mm}-${d.getUTCFullYear()}`,
    weekday: "Mon",
    sehri: "04:50",
    iftar: "18:00",
    fajr: "05:00",
    maghrib: "18:00",
  };
});
const isoOf = (roza: number) => {
  const [dd, mm, yyyy] = DAYS[roza - 1].gregorianDate.split("-");
  return `${yyyy}-${mm}-${dd}`;
};

describe("progressCopy", () => {
  it("picks an encouraging line by progress, never guilt", () => {
    expect(progressCopy(0, 0)).toBe("progressEmpty");
    expect(progressCopy(0, 7)).toBe("progressStart");
    expect(progressCopy(1, 7)).toBe("progressGoing");
    expect(progressCopy(3, 7)).toBe("progressGoing");
    expect(progressCopy(6, 7)).toBe("progressGoing");
    expect(progressCopy(7, 7)).toBe("progressDone");
  });
});

describe("windows and grouping", () => {
  it("guesses a window from Bengali and English titles", () => {
    expect(windowFromTitle("সেহরি ও নিয়ত")).toBe("sehriToDhuhr");
    expect(windowFromTitle("ফজর জামাতে")).toBe("sehriToDhuhr");
    expect(windowFromTitle("Morning dhikr")).toBe("sehriToDhuhr");
    expect(windowFromTitle("তারাবি")).toBe("afterIftar");
    expect(windowFromTitle("ঘুমের আগের যিকির")).toBe("afterIftar");
    expect(windowFromTitle("Tahajjud")).toBe("afterIftar");
    expect(windowFromTitle("দান · আজকের লক্ষ্য")).toBe("dhuhrToIftar");
    expect(windowFromTitle("Call my aunt")).toBe("dhuhrToIftar");
  });

  it("groups items in window order, keeping order inside a window, with every window present", () => {
    const items: { id: string; window: PlanWindow }[] = [
      { id: "a", window: "afterIftar" },
      { id: "b", window: "sehriToDhuhr" },
      { id: "c", window: "afterIftar" },
    ];
    const g = groupByWindow(items);
    expect(Object.keys(g)).toEqual(["sehriToDhuhr", "dhuhrToIftar", "afterIftar"]);
    expect(g.sehriToDhuhr.map((i) => i.id)).toEqual(["b"]);
    expect(g.dhuhrToIftar).toEqual([]);
    expect(g.afterIftar.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("the suggested day plan fills all three windows; the night practices are night keys", () => {
    const g = groupByWindow(DAY_DEFAULTS);
    // Fajr and the day's Quran are recorded by the salah and Quran khatm trackers, not suggested again.
    expect(g.sehriToDhuhr.map((d) => d.key)).toEqual(["sehri", "morningDhikr"]);
    expect(g.dhuhrToIftar.map((d) => d.key)).toEqual(["charity"]);
    expect(g.afterIftar).toHaveLength(2);
    expect(NIGHT_DEFAULTS.map((d) => d.key)).toEqual(["night:ishaTaraweeh", "night:nightQuran", "night:tahajjud", "night:qadrDua"]);
  });

  it("matches a suggestion by remembered key, then by title", () => {
    const titles = { sehri: ["সেহরি ও নিয়ত"], fajr: ["ফজর জামাতে"] };
    expect(matchDefaultKey("anything", "fajr", titles)).toBe("fajr");
    expect(matchDefaultKey(" সেহরি ও নিয়ত ", undefined, titles)).toBe("sehri");
    expect(matchDefaultKey("নিজের আমল", undefined, titles)).toBeUndefined();
  });

  it("parses stored item notes defensively", () => {
    expect(parseItemNotes(null)).toEqual({});
    expect(parseItemNotes("not json")).toEqual({});
    expect(parseItemNotes("[1]")).toEqual({});
    expect(parseItemNotes(JSON.stringify({ a: { window: "afterIftar", key: "sehri" }, b: { window: "noon" }, c: 3 }))).toEqual({
      a: { window: "afterIftar", key: "sehri" },
      b: { window: undefined, key: undefined },
    });
  });
});

describe("Quran progress", () => {
  it("reads the para from the tracker's free text", () => {
    expect(paraFromText("12")).toBe(12);
    expect(paraFromText("১২")).toBe(12);
    expect(paraFromText("para 3")).toBe(3);
    expect(paraFromText("")).toBeNull();
    expect(paraFromText("31")).toBeNull();
    expect(paraFromText(undefined)).toBeNull();
    expect(nextPara(12)).toBe(13);
    expect(nextPara(30)).toBe(30);
    expect(nextPara(null)).toBe(1);
  });

  it("counts consecutive days back from today, or from yesterday while today is empty", () => {
    const has = (set: string[]) => (iso: string) => set.includes(iso);
    expect(quranStreak("2027-03-03", has(["2027-03-03", "2027-03-02", "2027-03-01", "2027-02-27"]))).toBe(3);
    expect(quranStreak("2027-03-03", has(["2027-03-02", "2027-03-01"]))).toBe(2);
    expect(quranStreak("2027-03-01", has(["2027-02-28", "2027-02-27"]))).toBe(2);
    expect(quranStreak("2027-03-03", has([]))).toBe(0);
  });

  it("formats Bengali ordinals", () => {
    expect([1, 2, 3, 4, 5, 6, 10, 13, 30].map(bnOrdinal)).toEqual(["১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ", "১০ম", "১৩তম", "৩০তম"]);
  });
});

describe("last ten nights visibility", () => {
  const maghrib20 = at(isoOf(20), "18:00");
  it("is hidden outside Ramadan and up to roza 19", () => {
    expect(lastTenVisible(null, at(isoOf(25), "21:00"), null)).toBe(false);
    expect(lastTenVisible(19, at(isoOf(19), "23:00"), at(isoOf(19), "18:00"))).toBe(false);
    expect(lastTenVisible(1, at(isoOf(1), "23:00"), null)).toBe(false);
  });
  it("appears at the maghrib of roza 20, when the 21st night begins", () => {
    expect(lastTenVisible(20, at(isoOf(20), "17:59"), maghrib20)).toBe(false);
    expect(lastTenVisible(20, at(isoOf(20), "18:00"), maghrib20)).toBe(true);
    expect(lastTenVisible(20, at(isoOf(20), "23:30"), maghrib20)).toBe(true);
    // Unknown maghrib: wait for roza 21.
    expect(lastTenVisible(20, at(isoOf(20), "23:30"), null)).toBe(false);
  });
  it("stays visible all day on roza 21-29", () => {
    for (let d = 21; d <= 29; d += 1) {
      expect(lastTenVisible(d, at(isoOf(d), "03:00"), at(isoOf(d), "18:00"))).toBe(true);
      expect(lastTenVisible(d, at(isoOf(d), "12:00"), at(isoOf(d), "18:00"))).toBe(true);
      expect(lastTenVisible(d, at(isoOf(d), "22:00"), at(isoOf(d), "18:00"))).toBe(true);
    }
  });
  it("ends at the iftar of roza 30 (Eid night) and after Ramadan", () => {
    const maghrib30 = at(isoOf(30), "18:00");
    expect(lastTenVisible(30, at(isoOf(30), "12:00"), maghrib30)).toBe(true);
    expect(lastTenVisible(30, at(isoOf(30), "18:30"), maghrib30)).toBe(false);
    expect(lastTenVisible(31, at(isoOf(30), "12:00"), null)).toBe(false);
  });
});

describe("current night and default view", () => {
  const fajr26 = at(isoOf(26), "05:00");
  const maghrib26 = at(isoOf(26), "18:00");
  it("is the night that began yesterday before fajr, otherwise tonight's", () => {
    expect(currentNight(26, at(isoOf(26), "03:00"), fajr26)).toBe(26);
    expect(currentNight(26, at(isoOf(26), "05:00"), fajr26)).toBe(27);
    expect(currentNight(26, at(isoOf(26), "21:00"), fajr26)).toBe(27);
    expect(currentNight(26, at(isoOf(26), "03:00"), null)).toBe(27);
  });
  it("opens the night view at night and the day plan by day", () => {
    expect(defaultPlanView(true, at(isoOf(26), "21:00"), fajr26, maghrib26)).toBe("nights");
    expect(defaultPlanView(true, at(isoOf(26), "03:00"), fajr26, maghrib26)).toBe("nights");
    expect(defaultPlanView(true, at(isoOf(26), "12:00"), fajr26, maghrib26)).toBe("day");
    expect(defaultPlanView(false, at(isoOf(26), "21:00"), fajr26, maghrib26)).toBe("day");
  });
});

describe("tahajjud and night times", () => {
  it("suggests the start of the last third of the night", () => {
    // 18:00 -> 05:00 is 11 h; two thirds in = 18:00 + 7h20m = 01:20.
    const t = tahajjudTime(at("2027-03-06", "18:00"), at("2027-03-07", "05:00"));
    expect(t?.toISOString()).toBe(at("2027-03-07", "01:20").toISOString());
    // Rounded to the minute: 18:06 -> 04:48 = 10h42m, 2/3 = 7h08m -> 01:14.
    expect(tahajjudTime(at("2027-03-06", "18:06"), at("2027-03-07", "04:48"))?.toISOString()).toBe(
      at("2027-03-07", "01:14").toISOString(),
    );
    expect(tahajjudTime(at("2027-03-07", "05:00"), at("2027-03-06", "18:00"))).toBeNull();
  });

  it("takes the night's maghrib from roza N-1 and its fajr and sehri from roza N", () => {
    const n = nightTimes(DAYS, 27, TZ);
    expect(n?.maghrib.toISOString()).toBe(at(isoOf(26), "18:00").toISOString());
    expect(n?.fajr.toISOString()).toBe(at(isoOf(27), "05:00").toISOString());
    expect(n?.sehriEnd.toISOString()).toBe(at(isoOf(27), "04:50").toISOString());
    expect(n?.tahajjud.toISOString()).toBe(at(isoOf(27), "01:20").toISOString());
    expect(nightTimes(DAYS, 31, TZ)).toBeNull();
    expect(nightProgress(at(isoOf(26), "17:00"), n!)).toBe(0);
    expect(nightProgress(at(isoOf(27), "06:00"), n!)).toBe(1);
    expect(nightProgress(at(isoOf(26), "23:30"), n!)).toBeCloseTo(0.5, 5);
  });
});

describe("odd-night rows", () => {
  it("lists nights 21-29 on the evenings of roza 20/22/24/26/28, past and tonight marked", () => {
    const rows = oddNightRows(DAYS, 27);
    expect(rows.map((r) => r.night)).toEqual([21, 23, 25, 27, 29]);
    expect(rows.map((r) => r.evening?.day)).toEqual([20, 22, 24, 26, 28]);
    expect(rows.map((r) => r.morning?.day)).toEqual([21, 23, 25, 27, 29]);
    expect(rows.map((r) => r.state)).toEqual(["past", "past", "past", "tonight", "upcoming"]);
  });
  it("has no tonight on an even night", () => {
    expect(oddNightRows(DAYS, 26).map((r) => r.state)).toEqual(["past", "past", "past", "upcoming", "upcoming"]);
    expect(oddNightRows(DAYS, 21).map((r) => r.state)).toEqual(["tonight", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });
});

describe("night view availability", () => {
  it("roza 30: the 30th night before fajr, nothing after fajr (the next night is Eid night)", () => {
    const fajr30 = at(isoOf(30), "05:00");
    const maghrib30 = at(isoOf(30), "18:00");
    expect(nightsViewAvailable(30, at(isoOf(30), "03:00"), fajr30, maghrib30)).toBe(true);
    expect(currentNight(30, at(isoOf(30), "03:00"), fajr30)).toBe(30);
    expect(nightsViewAvailable(30, at(isoOf(30), "05:00"), fajr30, maghrib30)).toBe(false);
    expect(nightsViewAvailable(30, at(isoOf(30), "12:00"), fajr30, maghrib30)).toBe(false);
    expect(nightsViewAvailable(30, at(isoOf(30), "19:00"), fajr30, maghrib30)).toBe(false);
  });
  it("roza 20: from maghrib only", () => {
    const fajr20 = at(isoOf(20), "05:00");
    const maghrib20 = at(isoOf(20), "18:00");
    expect(nightsViewAvailable(20, at(isoOf(20), "17:59"), fajr20, maghrib20)).toBe(false);
    expect(nightsViewAvailable(20, at(isoOf(20), "18:00"), fajr20, maghrib20)).toBe(true);
    expect(currentNight(20, at(isoOf(20), "18:00"), fajr20)).toBe(21);
  });
  it("roza 29 after fajr is the 30th night; outside Ramadan never", () => {
    expect(nightsViewAvailable(29, at(isoOf(29), "20:00"), at(isoOf(29), "05:00"), at(isoOf(29), "18:00"))).toBe(true);
    expect(nightsViewAvailable(null, at(isoOf(29), "20:00"), null, null)).toBe(false);
  });
});

describe("done for the day", () => {
  it("a signed-in task tick counts only for the day it was made", () => {
    expect(doneForDay({ isDone: true, dueDate: "2027-03-01" }, "2027-03-01")).toBe(true);
    expect(doneForDay({ isDone: true, dueDate: "2027-02-28" }, "2027-03-01")).toBe(false);
    expect(doneForDay({ isDone: true, dueDate: null }, "2027-03-01")).toBe(false);
    expect(doneForDay({ isDone: false, dueDate: "2027-03-01" }, "2027-03-01")).toBe(false);
    expect(goalDoneForDay(true, "2027-03-01", "2027-03-01")).toBe(true);
    expect(goalDoneForDay(true, undefined, "2027-03-01")).toBe(false);
    expect(goalDoneForDay(false, "2027-03-01", "2027-03-01")).toBe(false);
  });
  it("night practices belong to the night's evening, so a tick after midnight stays with that night", () => {
    expect(tickScopeISO(true, "2027-03-07", "2027-03-06")).toBe("2027-03-06");
    expect(tickScopeISO(false, "2027-03-07", "2027-03-06")).toBe("2027-03-07");
    expect(tickScopeISO(true, "2027-03-07", null)).toBe("2027-03-07");
  });
  it("prunes notes of items that no longer exist, keeping a just-created id", () => {
    const notes = { a: { key: "sehri" }, b: { window: "afterIftar" as const }, c: {} };
    expect(pruneItemNotes(notes, new Set(["a"]), ["c"])).toEqual({ a: { key: "sehri" }, c: {} });
    expect(pruneItemNotes(notes, null)).toBe(notes);
  });
});

describe("plan rows (shared by /plan and the Home preview)", () => {
  const titlesByKey = { sehri: ["সেহরি খান"], quran: ["কুরআন পড়ুন"], "night:tahajjud": ["তাহাজ্জুদ"] };
  const defaultWindows = { sehri: "sehriToDhuhr", quran: "dhuhrToIftar", "night:tahajjud": "afterIftar" } as const;
  const tasks = [
    { id: "t1", title: "কুরআন পড়ুন", isDone: true, dueDate: "2027-03-01" },
    { id: "t2", title: "সেহরি খান", isDone: true, dueDate: "2027-02-28" },
    { id: "t3", title: "তাহাজ্জুদ", isDone: true, dueDate: "2027-02-28" },
  ];
  const goals = [{ id: "g1", title: "ইফতারের পর যিকর", isCompleted: true, targetCount: 100, targetUnit: "বার" }];
  const base = { tasks, goals, titlesByKey, defaultWindows, todayISO: "2027-03-01", eveningISO: null };

  it("keys, windows and done-for-the-day (guest and signed-in lists alike)", () => {
    const rows = buildPlanRows({ ...base, notes: { g1: { doneOn: "2027-03-01" } } });
    expect(rows.map((r) => [r.id, r.kind, r.key, r.window, r.done])).toEqual([
      ["t1", "task", "quran", "dhuhrToIftar", true],
      ["t2", "task", "sehri", "sehriToDhuhr", false],
      ["t3", "task", "night:tahajjud", "afterIftar", false],
      ["g1", "goal", undefined, "afterIftar", true],
    ]);
    expect(rows[3]).toMatchObject({ targetCount: 100, targetUnit: "বার", scopeISO: "2027-03-01" });
  });

  it("night practices count for the night's evening when it is known", () => {
    const rows = buildPlanRows({ ...base, notes: {}, eveningISO: "2027-02-28" });
    expect(rows.find((r) => r.id === "t3")).toMatchObject({ scopeISO: "2027-02-28", done: true });
  });

  it("yesterday's ticks do not count today (the lists persist across days); a note's window wins over the title guess", () => {
    const rows = buildPlanRows({ ...base, notes: { t2: { window: "afterIftar" } } });
    // t2/t3 were ticked on 2027-02-28; g1 has no tick day.
    expect(rows.map((r) => r.done)).toEqual([true, false, false, false]);
    expect(rows[1].window).toBe("afterIftar");
    expect(buildPlanRows({ ...base, tasks: [], goals: [], notes: {} })).toEqual([]);
  });

  it("display order follows the windows, keeping the order inside each", () => {
    const rows = buildPlanRows({ ...base, notes: {} });
    expect(planDisplayOrder(rows).map((r) => r.id)).toEqual(["t2", "t1", "t3", "g1"]);
  });
});

describe("nightEveningISO (Home uses the same night day as /plan)", () => {
  const today = "2027-03-03";
  const fajr = new Date("2027-03-02T23:00:00Z"); // 05:00 Dhaka
  const maghrib = new Date("2027-03-03T12:10:00Z"); // 18:10 Dhaka
  it("after midnight, before fajr: the night began yesterday evening", () => {
    expect(nightEveningISO(23, new Date("2027-03-02T20:00:00Z"), fajr, maghrib, today)).toBe("2027-03-02");
  });
  it("from maghrib: tonight's evening is today", () => {
    expect(nightEveningISO(23, new Date("2027-03-03T14:00:00Z"), fajr, maghrib, today)).toBe("2027-03-03");
  });
  it("during the day it is today's evening; outside the last ten nights null", () => {
    expect(nightEveningISO(23, new Date("2027-03-03T06:00:00Z"), fajr, maghrib, today)).toBe("2027-03-03");
    expect(nightEveningISO(12, new Date("2027-03-03T14:00:00Z"), fajr, maghrib, today)).toBeNull();
    expect(nightEveningISO(null, new Date("2027-03-03T14:00:00Z"), fajr, maghrib, today)).toBeNull();
  });
});
