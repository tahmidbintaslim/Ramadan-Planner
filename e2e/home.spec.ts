import type { Page } from "@playwright/test";
import { HYDRATION, test, expect, visit } from "./fixtures";

// Home screen (design system v2, Task 7). Timings and the Ramadan status are mocked (the CI server has no
// upstream access) and the clock is fixed in Dhaka, so the phase is known.

const TIMINGS = {
  prayerTimes: {
    fajr: "05:02",
    sunrise: "06:18",
    dhuhr: "12:14",
    asr: "16:18",
    maghrib: "17:58",
    isha: "19:12",
    sehri: "04:57",
    iftar: "17:58",
  },
  hijriDate: { day: "12", month: "Ramaḍān", year: "1448", monthAr: "رَمَضان", monthBn: "রমজান" },
  gregorianDate: "20-02-2027",
  timezone: "Asia/Dhaka",
  location: "ঢাকা, বাংলাদেশ",
  source: "aladhan",
};

const RAMADAN = {
  phase: "ramadan",
  currentDay: 12,
  daysUntil: null,
  ramadanStartGregorian: "09-02-2027",
  ramadanEndGregorian: "10-03-2027",
  hijriMonth: 9,
  hijriMonthName: "Ramadan",
  hijriDay: "12",
  hijriYear: "1448",
  ramadanTotalDays: 30,
};

async function mockHome(page: Page, at: string) {
  await page.clock.setFixedTime(new Date(`2027-02-20T${at}:00+06:00`));
  await page.route("**/api/timings?*", (r) => r.fulfill({ json: TIMINGS }));
  await page.route("**/api/ramadan?*", (r) => r.fulfill({ json: RAMADAN }));
}

test.use({ timezoneId: "Asia/Dhaka" });

test.describe("mobile Home", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders the hero, Sehri/Iftar pair, iftar dua and prayer list without console errors", async ({
    page,
    appErrors,
    consoleEntries,
  }) => {
    await mockHome(page, "17:30");
    const res = await visit(page, "/today");
    expect(res?.status()).toBe(200);
    const hero = page.getByRole("region", { name: /নামাজের সময় ও কাউন্টডাউন|Prayer time and countdown/ });
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("data-phase", "iftar");
    await expect(page.getByTestId("hero-source")).toContainText("AlAdhan");
    await expect(page.getByTestId("pair-iftar")).toBeVisible();
    await expect(page.getByTestId("phase-card")).toHaveAttribute("data-kind", "iftarDua");
    await expect(page.locator("li[data-prayer]")).toHaveCount(5);
    await expect(page.locator('li[data-prayer="maghrib"]')).toHaveAttribute("data-state", "next");
    for (const href of ["/quran", "/duas", "/tasbih", "/zakat"]) {
      await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
    }
    // Mobile order: hero, pair, phase card, prayers, tiles, plan.
    const top = (sel: string) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);
    const order = [
      await top('[data-phase]'),
      await top('[data-testid="pair-iftar"]'),
      await top('[data-testid="phase-card"]'),
      await top("li[data-prayer]"),
      await top('main a[href="/quran"]'),
      await top('[data-testid^="plan-item-"]'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The sadaqah card never shows in the day before the last ten nights.
    await expect(page.getByTestId("support-card")).toHaveCount(0);
    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });

  test("the bottom nav does not cover the end of the Home page", async ({ page }) => {
    await mockHome(page, "13:00");
    await visit(page, "/today");
    await expect(page.locator("li[data-prayer]")).toHaveCount(5);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const navTop = await page
      .getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ })
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    const contentBottom = await page.locator("main").evaluate((main) => {
      let bottom = 0;
      for (const el of Array.from(main.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.width > 0) bottom = Math.max(bottom, r.bottom);
      }
      return bottom;
    });
    expect(contentBottom).toBeLessThanOrEqual(navTop);
  });

  test("a prayer bell creates a guest reminder rule that survives a reload", async ({ page }) => {
    await mockHome(page, "13:00");
    await visit(page, "/today");
    const bell = page.getByRole("button", { name: /^(আসর রিমাইন্ডার|Asr reminder)$/ });
    await expect(bell).toHaveAttribute("aria-pressed", "false");
    await bell.click();
    await expect(bell).toHaveAttribute("aria-pressed", "true");
    const stored = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith("rp_reminder_rules_"))
        .flatMap((k) => JSON.parse(localStorage.getItem(k) || "[]")),
    );
    expect(stored).toEqual([
      expect.objectContaining({ type: "asr", offsetMinutes: -15, channels: ["push"], enabled: true }),
    ]);
    await page.reload({ waitUntil: "load" });
    await expect(page.getByRole("button", { name: /^(আসর রিমাইন্ডার|Asr reminder)$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test("desktop Home has two columns: hero on the left, prayers on the right; sadaqah after maghrib", async ({
  page,
  appErrors,
}) => {
  await mockHome(page, "20:00");
  await visit(page, "/today");
  const hero = page.locator("[data-phase]").first();
  await expect(hero).toHaveAttribute("data-phase", "night");
  const list = page.locator("li[data-prayer]").first();
  await expect(list).toBeVisible();
  const h = await hero.boundingBox();
  const l = await list.boundingBox();
  expect(h && l && l.x > h.x + h.width).toBeTruthy();
  expect(h && l && Math.abs(l.y - h.y) < 120).toBeTruthy();
  const support = page.getByTestId("support-card");
  await expect(support).toBeVisible();
  await support.getByRole("button").click();
  await expect(support).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("rp_sadaqah_dismissed_at"))).toBeTruthy();
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("li[data-prayer]").first()).toBeVisible();
  await expect(page.getByTestId("support-card")).toHaveCount(0);
  expect(appErrors()).toEqual([]);
});
