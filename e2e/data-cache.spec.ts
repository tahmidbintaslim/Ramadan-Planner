import { test, expect, visit } from "./fixtures";

// The shared data cache (src/lib/data-cache.ts): a tab revisit renders from memory with no new data request, and a
// reload shows the stored times before any answer arrives.
const TIMINGS = {
  prayerTimes: { fajr: "05:02", sunrise: "06:18", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12", sehri: "04:57", iftar: "17:58" },
  hijriDate: { day: "12", month: "Ramadan", year: "1448", monthAr: "", monthBn: "রমজান" },
  gregorianDate: "20-02-2027",
  timezone: "Asia/Dhaka",
  location: "ঢাকা, বাংলাদেশ",
  source: "aladhan",
};

test.use({ timezoneId: "Asia/Dhaka", viewport: { width: 390, height: 844 } });

test("a tab revisit sends no data request, and a reload shows the stored times at once", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-02-20T12:00:00+06:00"));
  const requested: string[] = [];
  let hold = false;
  await page.route(/\/api\/(timings|ramadan)/, async (r) => {
    requested.push(r.request().url());
    // While held the answer never comes: only the cache can paint the hero.
    if (hold) return;
    await r.fulfill({ json: r.request().url().includes("/api/timings") ? TIMINGS : { phase: "pre-ramadan", currentDay: null } });
  });

  await visit(page, "/today");
  await expect(page.locator("li[data-prayer]")).toHaveCount(5);
  // The shell's Ramadan day and the Home's status share one request.
  expect(requested.filter((u) => u.includes("/api/ramadan?"))).toHaveLength(1);

  await page.locator('nav a[href="/timetable"]:visible').first().click();
  await expect(page).toHaveURL(/\/timetable$/);
  requested.length = 0;
  await page.locator('nav a[href="/today"]:visible').first().click();
  await expect(page.locator("li[data-prayer]")).toHaveCount(5);
  expect(requested.filter((u) => /\/api\/(timings|ramadan)\?/.test(u))).toEqual([]);

  hold = true;
  await page.reload();
  await expect(page.locator("li[data-prayer]")).toHaveCount(5);
});
