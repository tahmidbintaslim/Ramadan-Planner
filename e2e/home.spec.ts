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
    // Mobile order: phase + next prayer, Sehri/Iftar, the five prayers, one contextual card, today's plan link, tiles.
    const top = (sel: string) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);
    const order = [
      await top('[data-phase]'),
      await top('[data-testid="pair-iftar"]'),
      await top("li[data-prayer]"),
      await top('[data-testid="phase-card"]'),
      await top('[data-testid="plan-preview"]'),
      await top('main a[href="/quran"]'),
    ];
    const heroHeight = await page.locator("[data-phase]").first().evaluate((el) => el.getBoundingClientRect().height);
    // v4 next-prayer card: padding 24, top row, Title 2, Display L time (about 176 tall).
    expect(heroHeight).toBeGreaterThanOrEqual(160);
    expect(heroHeight).toBeLessThanOrEqual(200);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The sadaqah card never shows in the day before the last ten nights.
    await expect(page.getByTestId("support-card")).toHaveCount(0);
    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });

  test("all five prayers are above the bottom nav on first load at 390x844", async ({ page }) => {
    await mockHome(page, "13:00");
    await visit(page, "/today");
    await expect(page.locator("li[data-prayer]")).toHaveCount(5);
    await page.waitForTimeout(500); // fonts swapped in
    const ishaBottom = await page.locator('li[data-prayer="isha"]').evaluate((el) => el.getBoundingClientRect().bottom);
    const navTop = await page
      .getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ })
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(ishaBottom).toBeLessThan(navTop);
  });

  test("the Home is focused: one sourced devotional card, no trackers, checklist or journal", async ({ page }) => {
    await mockHome(page, "13:00");
    await visit(page, "/today");
    await expect(page.locator("li[data-prayer]")).toHaveCount(5);
    // Outside the sehri/iftar moments the one devotional card is the day's ayah, with its reference.
    await expect(page.getByTestId("phase-card")).toHaveCount(0);
    const ayah = page.getByTestId("daily-ayah");
    await expect(ayah).toHaveCount(1);
    // The ayah is Quran text: Amiri Quran (font-quran), per the founder's type rule.
    await expect(ayah.locator('[lang="ar"]')).toHaveClass(/font-quran/);
    await expect(ayah).toContainText(/সূরা|Surah/);
    const main = page.locator("main");
    for (const gone of ["নামাজ ট্র্যাকার", "কুরআন খতম", "দৈনিক আমলের তালিকা", "রমজান ডায়েরি", "আজকের আমল ও ট্র্যাকার", "দিনের হাদিস"]) {
      await expect(main).not.toContainText(gone);
    }
    // The prayers appear once (the list), the plan once (the preview).
    await expect(page.getByRole("heading", { name: /নামাজের সময়|Prayer Times/ })).toHaveCount(1);
    await expect(page.getByTestId("plan-preview")).toHaveCount(1);
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
    const bell = page.getByRole("button", { name: /^(আসর নামাজের রিমাইন্ডার|Asr prayer reminder)$/ });
    await expect(bell).toHaveAttribute("aria-pressed", "false");
    await bell.click();
    await expect(bell).toHaveAttribute("aria-pressed", "true");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rp_reminder_rules") || "[]"));
    expect(stored).toEqual([
      expect.objectContaining({ type: "asr", offsetMinutes: -15, channels: ["push"], enabled: true }),
    ]);
    await page.reload({ waitUntil: "load" });
    await expect(page.getByRole("button", { name: /^(আসর নামাজের রিমাইন্ডার|Asr prayer reminder)$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("guest reminders saved under an old dated key are migrated and shown on the Reminders page", async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem("rp_migrated_once")) return;
      localStorage.setItem("rp_migrated_once", "1");
      const rule = (id: string, type: string) => ({ id, type, label: "", offsetMinutes: -15, channels: ["push"], enabled: true });
      localStorage.setItem("rp_reminder_rules_2027-02-18", JSON.stringify([rule("00000000-0000-4000-8000-000000000001", "fajr")]));
      localStorage.setItem("rp_reminder_rules_2027-02-19", JSON.stringify([rule("00000000-0000-4000-8000-000000000002", "isha")]));
      // What the old date-scoped hook left on the next day's first visit.
      localStorage.setItem("rp_reminder_rules_2027-02-20", "[]");
    });
    await mockHome(page, "13:00");
    await visit(page, "/today");
    await expect(page.getByRole("button", { name: /^(এশা নামাজের রিমাইন্ডার|ইশা নামাজের রিমাইন্ডার|Isha prayer reminder)$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The newest non-empty dated list wins; the dated keys stay until they expire.
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("rp_reminder_rules")));
    expect(keys.sort()).toEqual([
      "rp_reminder_rules",
      "rp_reminder_rules_2027-02-18",
      "rp_reminder_rules_2027-02-19",
      "rp_reminder_rules_2027-02-20",
    ]);
    // The Reminders page reads (and keeps) the same stable list.
    await visit(page, "/reminders");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rp_reminder_rules") || "[]"))).toEqual([
      expect.objectContaining({ type: "isha", enabled: true }),
    ]);
  });
});

test("desktop Today has two columns: card, pair and prayers on the left, amal and ayah on the right; sadaqah after maghrib", async ({
  page,
  appErrors,
}) => {
  await mockHome(page, "20:00");
  await visit(page, "/today");
  const hero = page.locator("[data-phase]").first();
  await expect(hero).toHaveAttribute("data-phase", "night");
  // After isha in Ramadan: tomorrow's sehri end (04:57 in the mocked answer), not tomorrow's fajr (05:02).
  await expect(hero).toContainText(/সেহরি শেষ|Sehri ends/);
  await expect(hero).toContainText(/৪:৫৭|4:57/);
  // …and the Sehri/Iftar pair shows tomorrow's times, labelled.
  await expect(page.getByTestId("pair-day")).toHaveText(/আগামীকাল|Tomorrow/);
  const list = page.locator("li[data-prayer]").first();
  await expect(list).toBeVisible();
  const h = await hero.boundingBox();
  const l = await list.boundingBox();
  const plan = await page.getByTestId("plan-preview").boundingBox();
  // Prayers sit under the card in the left column; today's amal starts the right column beside the card.
  expect(h && l && l.y > h.y + h.height && l.x >= h.x && l.x < h.x + h.width).toBeTruthy();
  expect(h && plan && plan.x > h.x + h.width && Math.abs(plan.y - h.y) < 120).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1, name: /^(আজ|Today)$/ })).toBeVisible();
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
