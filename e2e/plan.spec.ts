import { test, expect, visit, HYDRATION } from "./fixtures";
import type { Page } from "@playwright/test";

// Day plan and last ten nights (design system v2, Task 9). The Ramadan day, the timetable and today's timings are
// answered locally and the browser clock is fixed, so the night and odd-night logic is deterministic.
const TZ = "Asia/Dhaka";
const DAY_MS = 86_400_000;

/** The instant at `hh:mm` Dhaka time (UTC+6, no DST) on today's Dhaka date. */
function dhakaToday(hh: number, mm = 0): Date {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 6, mm));
}

async function mockRamadan(page: Page, today: number, now: Date) {
  await page.clock.setFixedTime(now);
  await page.route(/\/api\/ramadan(\?|$)/, (route) =>
    route.fulfill({ json: { phase: "ramadan", currentDay: today, daysUntil: null, ramadanStartGregorian: null, ramadanEndGregorian: null } }),
  );
  await page.route(/\/api\/ramadan-timetable/, (route) => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", weekday: "short" })
          .formatToParts(new Date(now.getTime() + (i + 1 - today) * DAY_MS))
          .map((p) => [p.type, p.value]),
      );
      return {
        day: i + 1,
        gregorianDate: `${parts.day}-${parts.month}-${parts.year}`,
        weekday: parts.weekday,
        sehri: "04:48",
        iftar: "18:06",
        fajr: "04:58",
        maghrib: "18:06",
      };
    });
    return route.fulfill({ json: { days, location: "ঢাকা, বাংলাদেশ", timezone: TZ, hijriYear: "1448", method: "Karachi" } });
  });
  await page.route(/\/api\/timings/, (route) =>
    route.fulfill({
      json: {
        prayerTimes: { fajr: "04:58", sunrise: "06:12", dhuhr: "12:10", asr: "16:20", maghrib: "18:06", isha: "19:22", sehri: "04:48", iftar: "18:06" },
        timezone: TZ,
      },
    }),
  );
}

test.describe("day plan (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "bn", timezoneId: TZ });

  test("renders the progress card and grouped checklist, and adds a deed", async ({ page, appErrors, consoleEntries }) => {
    await mockRamadan(page, 12, dhakaToday(12));
    await visit(page, "/plan");

    await expect(page.getByRole("heading", { level: 1, name: "আজকের পরিকল্পনা" })).toBeVisible();
    await expect(page.getByTestId("plan-caption")).toContainText("রোজা ১২");
    // Day 12: no last-ten-nights switch.
    await expect(page.getByRole("button", { name: "শেষ দশ রাত" })).toHaveCount(0);

    const progress = page.getByTestId("plan-progress");
    await expect(progress).toBeVisible();
    await expect(progress.getByRole("img")).toHaveText("০/০");

    await page.getByRole("button", { name: "প্রস্তাবিত আমল যোগ করুন" }).click();
    for (const overline of ["সেহরি থেকে যোহর", "যোহর থেকে ইফতার", "ইফতারের পর"]) {
      await expect(page.getByRole("heading", { level: 2, name: overline })).toBeVisible();
    }
    await expect(page.getByTestId("plan-item")).toHaveCount(7);
    await expect(page.locator('[data-window="sehriToDhuhr"] [data-testid="plan-item"]')).toHaveCount(3);
    await expect(page.locator('[data-window="sehriToDhuhr"]')).toContainText("সেহরি ও নিয়ত");
    await expect(page.locator('[data-window="sehriToDhuhr"]')).toContainText("৪:৪৮");
    await expect(progress.getByRole("img")).toHaveText("০/৭");
    await expect(page.getByTestId("plan-progress-copy")).toHaveText("বিসমিল্লাহ, শুরু করা যাক");

    await page.getByRole("checkbox", { name: /সেহরি ও নিয়ত/ }).click();
    await expect(page.getByRole("checkbox", { name: /সেহরি ও নিয়ত/ })).toHaveAttribute("aria-checked", "true");
    await expect(progress.getByRole("img")).toHaveText("১/৭");
    await expect(page.getByTestId("plan-progress-copy")).toHaveText("আলহামদুলিল্লাহ, ভালো চলছে");

    // The add sheet puts a new deed in the chosen window.
    await page.getByRole("button", { name: "+ নতুন আমল যোগ করুন" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("আমলের নাম").fill("পরিবারের সাথে দোয়া");
    const after = sheet.getByRole("button", { name: "ইফতারের পর" });
    await after.click();
    await expect(after).toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("button", { name: "যোগ করুন", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-window="afterIftar"]')).toContainText("পরিবারের সাথে দোয়া");
    await expect(progress.getByRole("img")).toHaveText("১/৮");

    // A goal template from the sheet keeps its target.
    await page.getByRole("button", { name: "+ নতুন আমল যোগ করুন" }).click();
    await sheet.getByRole("button", { name: "দৈনিক যিকর" }).click();
    await expect(sheet.getByLabel("লক্ষ্যমাত্রা (ঐচ্ছিক)")).toHaveValue("100");
    await sheet.getByRole("button", { name: "যোগ করুন", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("checkbox", { name: /দৈনিক যিকর/ })).toContainText("লক্ষ্য ১০০ বার");

    // Edit: rename and move a deed, then delete another.
    await page.getByRole("button", { name: "পরিবারের সাথে দোয়া সম্পাদনা করুন" }).click();
    await expect(sheet.getByRole("heading", { name: "আমল সম্পাদনা" })).toBeVisible();
    await sheet.getByLabel("আমলের নাম").fill("পরিবারের সাথে ইফতারের দোয়া");
    await sheet.getByRole("button", { name: "যোহর থেকে ইফতার" }).click();
    await sheet.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-window="dhuhrToIftar"]')).toContainText("পরিবারের সাথে ইফতারের দোয়া");
    await page.getByRole("button", { name: "তারাবি সম্পাদনা করুন" }).click();
    await sheet.getByRole("button", { name: "আমলটি মুছুন" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("checkbox", { name: /^তারাবি/ })).toHaveCount(0);
    await expect(progress.getByRole("img")).toHaveText("১/৮");

    // Guest data stays on the device.
    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("plan-item")).toHaveCount(8);
    await expect(page.locator('[data-window="dhuhrToIftar"]')).toContainText("পরিবারের সাথে ইফতারের দোয়া");

    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });
});

test.describe("last ten nights (mobile, night)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "bn", timezoneId: TZ });

  test("on the evening of roza 26 the night view opens and the 27th night is highlighted", async ({ page, appErrors }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("theme", "auto");
      } catch {
        // ignore
      }
    });
    await mockRamadan(page, 26, dhakaToday(21));
    await visit(page, "/plan");

    await expect(page.getByRole("heading", { level: 1, name: "শেষ দশ রাত" })).toBeVisible();
    await expect(page.getByRole("button", { name: "শেষ দশ রাত" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("plan-caption")).toContainText("২৭তম রাত");
    // Auto mode: Night from maghrib.
    await expect(page.locator("html")).toHaveClass(/dark/);

    const hero = page.getByTestId("night-hero");
    await expect(hero).toContainText("আজ রাতের তাহাজ্জুদ");
    // 18:06 -> 04:58 next morning: the last third starts at 01:21 (after midnight, so bn 12-hour says রাত).
    await expect(page.getByTestId("tahajjud-time")).toHaveText("রাত ১:২১");
    await expect(hero).toContainText("সেহরি শেষ ৪:৪৮");

    const rows = page.locator("li[data-night]");
    await expect(rows).toHaveCount(5);
    const tonight = page.locator('li[data-night="27"]');
    await expect(tonight).toHaveAttribute("aria-current", "date");
    await expect(tonight).toHaveAttribute("data-state", "tonight");
    await expect(tonight).toHaveClass(/bg-rp-gold-tint/);
    await expect(tonight).toContainText("বেজোড় রাত · লাইলাতুল কদরের সন্ধান");
    await expect(page.locator('li[data-night="25"]')).toHaveAttribute("data-state", "past");
    await expect(page.locator('li[data-night="29"]')).toHaveAttribute("data-state", "upcoming");

    // Tonight's practices are suggestions in the plan's checklist: ticking one adds it, already done.
    await expect(page.getByRole("heading", { level: 2, name: "আজ রাতের আমল" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /লাইলাতুল কদরের দোয়া/ })).toContainText("সূত্র: তিরমিজি ৩৫১৩");
    await expect(page.getByTestId("qadr-dua")).toContainText("اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي");
    const tahajjud = page.getByRole("checkbox", { name: /^তাহাজ্জুদ/ });
    await tahajjud.click();
    await expect(tahajjud).toHaveAttribute("aria-checked", "true");
    await page.reload({ waitUntil: "load" });
    await expect(page.getByRole("checkbox", { name: /^তাহাজ্জুদ/ })).toHaveAttribute("aria-checked", "true");

    // The chip switches to the day plan any time in the last ten days; the night deed is under "after iftar".
    await page.getByRole("button", { name: "আজকের পরিকল্পনা" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "আজকের পরিকল্পনা" })).toBeVisible();
    await expect(page.getByTestId("plan-progress").getByRole("img")).toHaveText("১/১");
    await expect(page.locator('[data-window="afterIftar"]')).toContainText("তাহাজ্জুদ");
    expect(appErrors()).toEqual([]);
  });

  test("roza 20 reserves the switch row by day and shows it from maghrib", async ({ page }) => {
    await mockRamadan(page, 20, dhakaToday(12));
    await visit(page, "/plan");
    await expect(page.getByTestId("plan-progress")).toBeVisible();
    await expect(page.getByTestId("plan-views-placeholder")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "শেষ দশ রাত" })).toHaveCount(0);
    await page.clock.setFixedTime(dhakaToday(19));
    await page.reload({ waitUntil: "load" });
    await expect(page.getByRole("button", { name: "শেষ দশ রাত" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('li[data-night="21"]')).toHaveAttribute("data-state", "tonight");
  });

  test("roza 30 after fajr shows the day plan only", async ({ page }) => {
    await mockRamadan(page, 30, dhakaToday(12));
    await visit(page, "/plan");
    await expect(page.getByRole("heading", { level: 1, name: "আজকের পরিকল্পনা" })).toBeVisible();
    await expect(page.getByTestId("plan-progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "শেষ দশ রাত" })).toHaveCount(0);
    await expect(page.getByRole("status", { name: "শেষ দশ রাতের সময় লোড হচ্ছে" })).toHaveCount(0);
  });

  test("roza 19 has no last-ten-nights switch", async ({ page }) => {
    await mockRamadan(page, 19, dhakaToday(21));
    await visit(page, "/plan");
    await expect(page.getByRole("heading", { level: 1, name: "আজকের পরিকল্পনা" })).toBeVisible();
    await expect(page.getByTestId("plan-progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "শেষ দশ রাত" })).toHaveCount(0);
  });
});

test.describe("Home plan preview matches /plan", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "bn", timezoneId: TZ });

  test("empty on both, then the same rows and count after adding on /plan", async ({ page, appErrors }) => {
    await mockRamadan(page, 12, dhakaToday(12));
    await visit(page, "/today");
    const preview = page.getByTestId("plan-preview");
    await expect(preview.getByRole("heading", { level: 2 })).toHaveText("আজকের পরিকল্পনা · ০/০");
    await expect(preview.getByTestId("plan-preview-empty")).toBeVisible();

    await visit(page, "/plan");
    await page.getByRole("button", { name: "প্রস্তাবিত আমল যোগ করুন" }).click();
    await expect(page.getByTestId("plan-item")).toHaveCount(7);
    await page.getByRole("checkbox", { name: /সেহরি ও নিয়ত/ }).click();
    await expect(page.getByTestId("plan-progress").getByRole("img")).toHaveText("১/৭");

    await visit(page, "/today");
    await expect(preview.getByRole("heading", { level: 2 })).toHaveText("আজকের পরিকল্পনা · ১/৭");
    const boxes = preview.getByRole("checkbox");
    await expect(boxes).toHaveCount(3);
    await expect(boxes.first()).toContainText("সেহরি ও নিয়ত");
    await expect(boxes.first()).toHaveAttribute("aria-checked", "true");
    expect(appErrors()).toEqual([]);
  });
});
