import type { Page } from "@playwright/test";
import { HYDRATION, test, expect, visit } from "./fixtures";

// First-run onboarding (design system v2, Task 11): a guest without a stored location is sent from /today to
// /welcome, picks a district (no sign-up) and lands on the Home with that district's times; a reload skips it.

const TIMINGS = {
  prayerTimes: { fajr: "05:02", sunrise: "06:18", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12", sehri: "04:57", iftar: "17:58" },
  hijriDate: { day: "12", month: "Ramaḍān", year: "1448", monthAr: "رَمَضان", monthBn: "রমজান" },
  gregorianDate: "20-02-2027",
  timezone: "Asia/Dhaka",
  location: "ঢাকা, বাংলাদেশ",
  source: "aladhan",
};

/** Mock the Home's APIs and record the /api/timings URLs. */
async function mockApis(page: Page) {
  const timingUrls: string[] = [];
  await page.clock.setFixedTime(new Date("2027-02-20T13:00:00+06:00"));
  await page.route("**/api/timings?*", (r) => {
    timingUrls.push(r.request().url());
    return r.fulfill({ json: TIMINGS });
  });
  await page.route("**/api/ramadan?*", (r) => r.fulfill({ json: { phase: "ramadan", currentDay: 12, hijriDay: "12", hijriMonth: 9 } }));
  return timingUrls;
}

const hero = (page: Page) => page.getByRole("region", { name: /নামাজের সময় ও কাউন্টডাউন|Prayer time and countdown/ });
/** The district in Today's header (v4: the location button above the next-prayer card). */
const place = (page: Page) => page.getByTestId("today-location");
const CONFIRM = "নিশ্চিত করুন";

/** The welcome flow starts with the language step; Continue leads to the district. */
async function toLocationStep(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ভাষা বেছে নিন");
  await page.getByRole("button", { name: "চালিয়ে যান" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("আপনার এলাকা");
}

test.use({ timezoneId: "Asia/Dhaka", viewport: { width: 390, height: 844 } });

test.describe("first run", () => {
  test.use({ onboarded: false });

  test("pick a district, land on /today with it, and a reload skips onboarding", async ({ page, appErrors, consoleEntries }) => {
    const timingUrls = await mockApis(page);
    await visit(page, "/today");
    await expect(page).toHaveURL(/\/welcome$/);
    await toLocationStep(page);
    // While gated the Home fetched nothing; the only times so far are the welcome preview's Dhaka times
    // (live, never sample: #32), fetched without a geolocation prompt.
    expect(timingUrls.every((u) => /lat=23\.81&lng=90\.41/.test(u))).toBe(true);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    await page.getByRole("button", { name: "সিলেট", exact: true }).click();
    await expect(page.getByRole("button", { name: "সিলেট", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: CONFIRM }).click();

    await expect(page).toHaveURL(/\/today$/);
    await expect(place(page)).toHaveText("সিলেট");
    // Sylhet's coordinates (2 decimals) and Bangladesh's zone, without a geolocation prompt.
    await expect.poll(() => timingUrls.some((u) => /lat=24\.90&lng=91\.87/.test(u) && /tz=Asia%2FDhaka/.test(u))).toBe(true);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rp_location") ?? "null"));
    expect(stored).toMatchObject({ v: 1, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87 });

    await page.reload({ waitUntil: "load" });
    await expect(page).toHaveURL(/\/today$/);
    await expect(place(page)).toHaveText("সিলেট");
    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });

  test("type a district (old spelling), choose it from the list", async ({ page }) => {
    await mockApis(page);
    await visit(page, "/welcome");
    await toLocationStep(page);
    const input = page.getByRole("combobox", { name: /জেলা/ });
    await input.fill("chitt");
    await page.getByRole("option", { name: /চট্টগ্রাম/ }).click();
    await expect(input).toHaveValue("চট্টগ্রাম");
    await page.getByRole("button", { name: CONFIRM }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(place(page)).toHaveText("চট্টগ্রাম");
  });

  test("an unknown name is not accepted; 'later' uses the Dhaka default", async ({ page }) => {
    await mockApis(page);
    await visit(page, "/welcome");
    await toLocationStep(page);
    await page.getByRole("combobox", { name: /জেলা/ }).fill("Atlantis");
    await page.getByRole("button", { name: CONFIRM }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByText(/কোনো জেলা পাওয়া যায়নি/)).toBeVisible();

    await page.getByRole("button", { name: /পরে করব.*ঢাকা/ }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(place(page)).toHaveText("ঢাকা");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rp_location") ?? "null"))).toMatchObject({
      kind: "default",
      districtId: "dhaka",
    });
  });

  test("landing 'start free' leads a first-time guest to onboarding", async ({ page }) => {
    await visit(page, "/");
    const start = page.getByTestId("landing-start");
    await expect(start).toHaveAttribute("href", "/welcome");
    await start.click();
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test("denied geolocation shows a friendly fallback", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: unknown, fail: (e: { code: number; PERMISSION_DENIED: number }) => void) =>
            fail({ code: 1, PERMISSION_DENIED: 1 }),
        },
      });
    });
    await visit(page, "/welcome");
    await toLocationStep(page);
    await page.getByRole("button", { name: "আমার অবস্থান ব্যবহার করুন" }).click();
    await expect(page.getByRole("status")).toHaveText(/অনুমতি পাওয়া যায়নি.*জেলা বেছে নিন/);
  });
});

test.describe("first run with location allowed", () => {
  test.use({ onboarded: false, geolocation: { latitude: 22.3569, longitude: 91.7832 }, permissions: ["geolocation"] });

  test("the device position is rounded and named after the nearest district", async ({ page }) => {
    const timingUrls = await mockApis(page);
    await visit(page, "/welcome");
    await toLocationStep(page);
    await page.getByRole("button", { name: "আমার অবস্থান ব্যবহার করুন" }).click();
    await expect(page.getByRole("status")).toHaveText(/আপনার কাছের জেলা: চট্টগ্রাম/);
    await page.getByRole("button", { name: CONFIRM }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(place(page)).toHaveText("চট্টগ্রাম");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rp_location") ?? "null"))).toMatchObject({
      kind: "geo",
      districtId: "chattogram",
      lat: 22.36,
      lng: 91.78,
    });
    await expect.poll(() => timingUrls.some((u) => /lat=22\.36&lng=91\.78/.test(u))).toBe(true);
  });
});

test("Today's location button opens the location sheet; Done saves the district and refetches its times", async ({ page }) => {
  const timingUrls = await mockApis(page);
  await visit(page, "/today");
  await expect(place(page)).toHaveText("ঢাকা");
  await place(page).click();
  const sheet = page.getByRole("dialog", { name: "আপনার এলাকা" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "সিলেট", exact: true }).click();
  await sheet.getByRole("button", { name: "সম্পন্ন" }).click();
  await expect(sheet).toBeHidden();
  await expect(place(page)).toHaveText("সিলেট");
  await expect.poll(() => timingUrls.some((u) => /lat=24\.90&lng=91\.87/.test(u))).toBe(true);
  // Cancel leaves the choice as it was.
  await place(page).click();
  await sheet.getByRole("button", { name: "চট্টগ্রাম", exact: true }).click();
  await sheet.getByRole("button", { name: "বাতিল" }).click();
  await expect(place(page)).toHaveText("সিলেট");
});

test("a returning guest goes straight to /today, and the landing CTA points there", async ({ page }) => {
  await mockApis(page);
  await visit(page, "/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(hero(page)).toBeVisible();
  await visit(page, "/");
  await expect(page.getByTestId("landing-start")).toHaveAttribute("href", "/today");
});

test.describe("signed in, no stored location", () => {
  test.use({ onboarded: false });

  test("a signed-in session is never sent to onboarding and the Home loads", async ({ page }) => {
    const timingUrls = await mockApis(page);
    // A non-zero __client_uat is Clerk's "a session exists" marker. Set on the client only: the server keeps the
    // signed-out cookie (a non-zero one would start a handshake with the fake Clerk instance).
    await page.addInitScript(() => {
      document.cookie = "__client_uat=1730600000; path=/";
    });
    await visit(page, "/today");
    await expect(hero(page)).toBeVisible();
    await page.waitForTimeout(3500); // past the gate's auth timeout
    await expect(page).toHaveURL(/\/today$/);
    expect(await page.evaluate(() => localStorage.getItem("rp_location"))).toBeNull();
    expect(timingUrls.length).toBeGreaterThan(0);
  });
});

test("the timetable uses the district chosen at onboarding, without a location prompt", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "rp_location",
      JSON.stringify({ v: 1, kind: "district", districtId: "rajshahi", lat: 24.37, lng: 88.6, tz: "Asia/Dhaka", savedAt: "" }),
    );
    (window as unknown as { __geoCalls: number }).__geoCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: () => void ((window as unknown as { __geoCalls: number }).__geoCalls += 1) },
    });
  });
  const urls: string[] = [];
  await page.route(/\/api\/ramadan-timetable/, (r) => {
    urls.push(r.request().url());
    return r.fulfill({ status: 503, json: { error: "x" } });
  });
  await visit(page, "/timetable");
  await expect.poll(() => urls.length).toBeGreaterThan(0);
  expect(urls[0]).toMatch(/tz=Asia%2FDhaka&lat=24\.37&lng=88\.60/);
  expect(await page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls)).toBe(0);
});

test.describe("landing for a first-time visitor", () => {
  test.use({ onboarded: false });

test("landing shows today's live times for Dhaka with a source line, never sample times (#32)", async ({ page }) => {
  await mockApis(page);
  await visit(page, "/");
  const today = page.getByTestId("landing-sample");
  await expect(today).toContainText("আজ · ঢাকা");
  // The mocked answer's sehri end, the next prayer at 13:00 (Asr) and iftar, period first in Bengali.
  await expect(today).toContainText("ভোর ৪:৫৭");
  await expect(today).toContainText("পরবর্তী নামাজ");
  await expect(today).toContainText("আসর");
  await expect(today).toContainText("বিকাল ৪:১৮");
  await expect(today).toContainText("সন্ধ্যা ৫:৫৮");
  await expect(page.locator("main")).not.toContainText("নমুনা");
  await expect(page.locator("main")).toContainText("উৎস: AlAdhan · করাচি · হানাফি আসর");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "সময়সূচি" })).toHaveAttribute("href", "/timetable");
  await expect(page.locator('footer a[href="/support"]')).toBeVisible();
  // The homepage v2 sections (Figma page 11) render on the server.
  for (const name of ["তিন ধাপে আপনার রমজান শুরু", "রমজানের জন্য যা যা দরকার", "যেকোনো ডিভাইসে", "সাপোর্ট ও অবদান"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
});
});
