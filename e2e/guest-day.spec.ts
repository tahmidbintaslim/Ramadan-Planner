import { test, expect, visit } from "./fixtures";

// Guest day keys are the LOCAL date. They used to be the UTC date, so in Dhaka (UTC+6) a guest's trackers reset at
// 06:00: a Fajr tick at 05:30 was stored under yesterday's UTC date and vanished at 06:00. Timings and the Ramadan
// status are mocked (the CI server has no upstream access); the clock starts at 05:30 in Dhaka and keeps running.

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

test.use({ timezoneId: "Asia/Dhaka" });

test("a guest's Fajr tick at 05:30 in Dhaka is still there at 06:30", async ({ page, appErrors }) => {
  await page.clock.install({ time: new Date("2027-02-20T05:30:00+06:00") });
  const requested: string[] = [];
  await page.route("**/api/timings?*", (r) => {
    requested.push(r.request().url());
    return r.fulfill({ json: TIMINGS });
  });
  await page.route("**/api/ramadan?*", (r) => {
    requested.push(r.request().url());
    return r.fulfill({ json: RAMADAN });
  });

  await visit(page, "/today");
  const fajr = page.locator("button[aria-pressed]").filter({ hasText: /^(ফজর|Fajr)$/ });
  await expect(fajr).toHaveCount(1);
  await fajr.click();
  await expect(fajr).toHaveAttribute("aria-pressed", "true");

  // Stored under the local date (20 Feb), not the UTC date (19 Feb, 23:30).
  const stored = (key: string) => page.evaluate((k) => localStorage.getItem(k), key);
  await expect.poll(() => stored("rp_salah_2027-02-20"), { timeout: 10_000 }).toContain('"fajr":true');
  expect(await stored("rp_salah_2027-02-19")).toBeNull();
  // Every timings/ramadan request carries a local date (the CDN cache key): today, or tomorrow for the Home's
  // next-day timings.
  expect(requested.some((u) => u.includes("/api/ramadan?") && u.includes("date=2027-02-20"))).toBe(true);
  for (const url of requested) expect(["2027-02-20", "2027-02-21"]).toContain(new URL(url).searchParams.get("date"));

  // An hour later, past 06:00 (00:00 UTC): the same tab keeps the tick...
  await page.clock.fastForward("01:00:00");
  await expect(fajr).toHaveAttribute("aria-pressed", "true");
  // ...and so does a fresh load.
  await visit(page, "/today");
  await expect(fajr).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => new Date().toISOString())).toMatch(/^2027-02-20T00:3/);

  // Jumping the clock an hour fires clerk-js's load timeout (its host is blocked in tests): not app noise.
  expect(appErrors().filter((e) => !/failed_to_load_clerk_js/.test(e.text))).toEqual([]);
});
