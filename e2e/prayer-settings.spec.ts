import { test, expect, visit } from "./fixtures";

// Settings → Location & prayer times: method, Asr school and Hijri adjustment are kept on the device, and every
// timings request carries them. The returning guest's stored location is a v1 value (fixtures), migrated to BD.

test.use({ timezoneId: "Asia/Dhaka", viewport: { width: 390, height: 844 }, appLocale: "en" });

test("method, Asr and Hijri adjustment are saved and sent with the timings requests", async ({ page }) => {
  const urls: string[] = [];
  await page.route("**/api/timings?*", (r) => {
    urls.push(r.request().url());
    return r.fulfill({ json: { prayerTimes: { fajr: "05:02", sunrise: "06:18", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12", sehri: "04:57", iftar: "17:58" }, hijriDate: { day: "1", month: "Ramaḍān", year: "1448", monthAr: "", monthBn: "" }, gregorianDate: "20-02-2027", timezone: "Asia/Dhaka", location: "Dhaka", source: "aladhan", calc: { method: 1, school: 1, country: "BD" } } });
  });
  await page.route("**/api/ramadan?*", (r) => r.fulfill({ json: { phase: "pre-ramadan", currentDay: null } }));

  await visit(page, "/settings");
  const card = page.getByTestId("location-prayer-card");
  await expect(card.getByText("Location & prayer times")).toBeVisible();
  await expect(card.getByTestId("calc-method-value")).toHaveText("Karachi (University of Islamic Sciences)");
  await expect(card.getByTestId("calc-asr").getByRole("button", { name: "Hanafi" })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByText("Times from AlAdhan")).toBeVisible();

  await card.getByRole("button", { name: /Calculation method/ }).click();
  await card.getByRole("radio", { name: /Muslim World League/ }).click();
  await expect(card.getByRole("radio", { name: /Muslim World League/ })).toHaveAttribute("aria-checked", "true");
  await card.getByTestId("calc-asr").getByRole("button", { name: "Standard" }).click();
  await card.getByTestId("calc-hijri").getByRole("button", { name: "+1 days" }).click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rp_location") ?? "null"));
  expect(stored).toMatchObject({ v: 2, country: "BD", method: 3, school: 0 });
  expect(await page.evaluate(() => localStorage.getItem("rp_hijri_adjust"))).toBe("1");

  urls.length = 0;
  await visit(page, "/today");
  await expect.poll(() => urls.some((u) => /cc=BD&method=3&school=0&hadj=1/.test(u))).toBe(true);
  await expect(page.getByText("AlAdhan · Karachi (University of Islamic Sciences) · Hanafi Asr").first()).toBeVisible();
});
