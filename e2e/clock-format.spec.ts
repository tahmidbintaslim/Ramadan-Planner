import type { Page } from "@playwright/test";
import { test, expect, visit } from "./fixtures";

// The clock format setting (/settings): 12-hour by default, 24-hour on request, and every time on Home follows it.
// Timings are mocked and the clock fixed in Dhaka (as in home.spec.ts).

const TIMINGS = {
  prayerTimes: { fajr: "05:02", sunrise: "06:18", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12", sehri: "04:57", iftar: "17:58" },
  hijriDate: { day: "12", month: "Ramaḍān", year: "1448", monthAr: "رَمَضان", monthBn: "রমজান" },
  gregorianDate: "20-02-2027",
  timezone: "Asia/Dhaka",
  location: "ঢাকা, বাংলাদেশ",
  source: "aladhan",
};

async function mockHome(page: Page) {
  await page.clock.setFixedTime(new Date("2027-02-20T13:00:00+06:00"));
  await page.route("**/api/timings?*", (r) => r.fulfill({ json: TIMINGS }));
  await page.route("**/api/ramadan?*", (r) => r.fulfill({ json: { phase: "ramadan", currentDay: 12, daysUntil: null, hijriMonth: 9, hijriDay: "12", hijriYear: "1448", ramadanTotalDays: 30 } }));
}

test.use({ timezoneId: "Asia/Dhaka", viewport: { width: 390, height: 844 } });

test.describe("English", () => {
  test.use({ appLocale: "en" });

  test("12-hour with AM/PM by default; the 24-hour choice applies everywhere and survives a reload", async ({ page }) => {
    await mockHome(page);
    await visit(page, "/today");
    await expect(page.getByTestId("pair-iftar")).toContainText("5:58 PM");
    await expect(page.locator('li[data-prayer="fajr"]')).toContainText("5:02 AM");

    await visit(page, "/settings");
    const group = page.getByTestId("clock-format");
    await expect(page.getByText("Time format")).toBeVisible();
    const h24 = group.getByRole("button", { name: "24-hour" });
    await expect(group.getByRole("button", { name: "12-hour" })).toHaveAttribute("aria-pressed", "true");
    await h24.click();
    await expect(h24).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("rp_clock_format"))).toBe("24h");
    const box = await h24.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await visit(page, "/today");
    await expect(page.getByTestId("pair-iftar")).toContainText("17:58");
    await expect(page.getByTestId("pair-iftar")).not.toContainText("PM");
    await expect(page.locator('li[data-prayer="fajr"]')).toContainText("05:02");
  });
});

test.describe("Bengali", () => {
  test("12-hour without a period by default; the control reads সময়ের ফরম্যাট", async ({ page }) => {
    await mockHome(page);
    await visit(page, "/today");
    await expect(page.getByTestId("pair-iftar")).toContainText("৫:৫৮");
    await visit(page, "/settings");
    await expect(page.getByText("সময়ের ফরম্যাট")).toBeVisible();
    await expect(page.getByTestId("clock-format").getByRole("button", { name: "১২ ঘণ্টা" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("clock-format").getByRole("button", { name: "২৪ ঘণ্টা" })).toBeVisible();
  });
});
