import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import { DEFAULT_TITLES, defaultTitlesByKey } from "./default-titles";
import { DAY_DEFAULTS, NIGHT_DEFAULTS, buildPlanRows, itemMessageKey, matchDefaultKey } from "./plan-logic";

const items = (m: unknown) => (m as { plan: { items: Record<string, string> } }).plan.items;

describe("DEFAULT_TITLES", () => {
  it("covers exactly the default suggestions", () => {
    expect(Object.keys(DEFAULT_TITLES).sort()).toEqual([...DAY_DEFAULTS, ...NIGHT_DEFAULTS].map((d) => d.key).sort());
  });

  it("stays in sync with plan.items in both message files", () => {
    for (const [key, titles] of Object.entries(DEFAULT_TITLES)) {
      expect(titles.bn, key).toBe(items(bn)[itemMessageKey(key)]);
      expect(titles.en, key).toBe(items(en)[itemMessageKey(key)]);
    }
  });
});

describe("matchDefaultKey across languages", () => {
  const titles = defaultTitlesByKey();

  it("recognises a suggestion by its Bengali or its English title, whatever the current locale", () => {
    expect(matchDefaultKey("সেহরি ও নিয়ত", undefined, titles)).toBe("sehri");
    expect(matchDefaultKey("Sehri and intention", undefined, titles)).toBe("sehri");
    expect(matchDefaultKey("  Tahajjud ", undefined, titles)).toBe("night:tahajjud");
    expect(matchDefaultKey("তাহাজ্জুদ", undefined, titles)).toBe("night:tahajjud");
    expect(matchDefaultKey("Laylat al-Qadr dua", undefined, titles)).toBe("night:qadrDua");
  });

  it("leaves the user's own items alone and prefers the remembered key", () => {
    expect(matchDefaultKey("My own amal", undefined, titles)).toBeUndefined();
    expect(matchDefaultKey("sehri and intention", undefined, titles)).toBeUndefined();
    expect(matchDefaultKey("Tahajjud", "fajr", titles)).toBe("fajr");
  });

  it("keeps an extra (current-locale) title and adds no duplicates", () => {
    const withExtra = defaultTitlesByKey({ sehri: "Sehri ✦", fajr: "ফজর জামাতে" });
    expect(withExtra.sehri).toEqual(["Sehri ✦", "সেহরি ও নিয়ত", "Sehri and intention"]);
    expect(withExtra.fajr).toEqual(["ফজর জামাতে", "Fajr in congregation"]);
  });

  it("an English-titled suggestion keeps its window and night scope in a Bengali plan", () => {
    const rows = buildPlanRows({
      tasks: [{ id: "t1", title: "Tahajjud", isDone: false, dueDate: null }],
      goals: [],
      isGuest: true,
      notes: {},
      titlesByKey: titles,
      defaultWindows: { "night:tahajjud": "afterIftar" },
      todayISO: "2027-03-01",
      eveningISO: "2027-02-28",
    });
    expect(rows[0]).toMatchObject({ key: "night:tahajjud", window: "afterIftar", scopeISO: "2027-02-28" });
  });
});
