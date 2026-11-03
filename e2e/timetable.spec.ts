import { test, expect, visit } from "./fixtures";
import type { Page } from "@playwright/test";

// Ramadan timetable screen (design system v2, Task 8). The API is answered locally: day 15 is today.
async function mockTimetable(page: Page) {
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  await page.route(/\/api\/ramadan-timetable/, (route) => {
    const now = Date.now();
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now + (i + 1 - 15) * 86_400_000);
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" })
          .formatToParts(d)
          .map((p) => [p.type, p.value]),
      );
      return {
        day: i + 1,
        gregorianDate: `${parts.day}-${parts.month}-${parts.year}`,
        weekday: "Mon",
        sehri: "04:50",
        iftar: "17:55",
        fajr: "05:00",
        maghrib: "17:55",
      };
    });
    return route.fulfill({ json: { days, location: "ঢাকা, বাংলাদেশ", timezone: tz, hijriYear: "1448", method: "Karachi" } });
  });
}

test.describe("timetable (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "bn" });

  test("shows the decade containing today, marks today and odd nights, and the tab is current", async ({ page, appErrors }) => {
    await page.goto("/timetable");
    await mockTimetable(page);
    await page.reload({ waitUntil: "load" });

    await expect(page.getByRole("heading", { level: 1, name: "রমজানের সময়সূচি" })).toBeVisible();
    await expect(page.getByTestId("timetable-caption")).toContainText("(আনুমানিক)");

    // Day 15 is today: the middle decade is selected and the row is highlighted.
    const middle = page.getByRole("button", { name: "মাগফিরাতের দশক" });
    await expect(middle).toHaveAttribute("aria-pressed", "true");
    const today = page.locator('[data-decade-panel="maghfirah"] li[aria-current="date"]');
    await expect(today).toHaveCount(1);
    await expect(today).toHaveAttribute("data-state", "today");
    await expect(today).toHaveClass(/bg-rp-live/);

    // Past rows are muted, odd nights sit in the last decade.
    await expect(page.locator('[data-decade-panel="maghfirah"] li[data-state="past"]').first()).toHaveClass(/text-rp-muted/);
    await page.getByRole("button", { name: "নাজাতের দশক" }).click();
    // A night starts after iftar: rozas 20, 22, 24, 26, 28 carry nights 21, 23, 25, 27, 29.
    await expect(page.locator('[data-decade-panel="maghfirah"] li[data-odd-night]')).toHaveCount(1);
    const odd = page.locator('[data-decade-panel="najat"] li[data-odd-night]');
    await expect(odd).toHaveCount(4);
    await expect(odd.first()).toHaveClass(/bg-rp-gold-tint/);
    await expect(odd.first()).toContainText("ইফতারের পর ২৩তম রাত · বেজোড় রাত");
    await expect(page.locator('[data-decade-panel="najat"] li').first()).not.toHaveAttribute("data-odd-night", "true");
    await expect(page.locator('[data-decade-panel="najat"] li').first()).toBeVisible();
    await expect(page.locator('[data-decade-panel="rahmat"]')).toBeHidden();

    // The timetable tab stays in the shell and is the current page.
    const nav = page.getByRole("navigation", { name: /প্রধান নেভিগেশন/ }).first();
    await expect(nav.locator('a[href="/timetable"]')).toHaveAttribute("aria-current", "page");
    expect(appErrors()).toEqual([]);
  });

  test("print renders all 30 days on white without the app chrome", async ({ page }) => {
    await page.goto("/timetable");
    await mockTimetable(page);
    await page.reload({ waitUntil: "load" });
    await expect(page.locator('[data-decade-panel="maghfirah"] li').first()).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("[data-decade-panel] li:visible")).toHaveCount(30);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.locator("header")).toBeHidden();
    await expect(page.getByRole("button", { name: "শেয়ার" })).toBeHidden();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(255, 255, 255)");
  });

  test("share falls back to copying the link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/timetable");
    await mockTimetable(page);
    await page.reload({ waitUntil: "load" });
    await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    await page.getByRole("button", { name: "শেয়ার" }).click();
    await expect(page.getByText("লিংক কপি হয়েছে")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/timetable$/);
  });
});

test("a failed share shows the share message, not the load error", async ({ page }) => {
  await page.goto("/timetable");
  await mockTimetable(page);
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { value: () => Promise.reject(new Error("nope")), configurable: true });
  });
  await page.getByRole("button", { name: /শেয়ার|Share/ }).click();
  await expect(page.getByText(/লিংক কপি করা যায়নি|Could not copy the link/)).toBeVisible();
  await expect(page.getByText(/সময়সূচি লোড করা যায়নি|Could not load the timetable/)).toHaveCount(0);
});

test("the timetable page loads without console errors when the API is unavailable", async ({ page, appErrors }) => {
  await page.route(/\/api\/ramadan-timetable/, (r) => r.fulfill({ status: 502, json: { error: "x" } }));
  await visit(page, "/timetable");
  await expect(page.getByRole("button", { name: /আবার চেষ্টা করুন|Try again/ })).toBeVisible();
  expect(appErrors()).toEqual([]);
});
