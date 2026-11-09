import { test, expect, visit, HYDRATION, LEAK } from "./fixtures";

// Every page renders for a guest with the placeholder database: HTTP 200, a visible heading, no app console
// errors and no hydration warnings. (Promoted from the old scripts/smoke.mjs.)
const ROUTES = [
  "/", "/today", "/plan", "/timetable", "/support", "/quran", "/reminders", "/duas", "/books", "/quiz",
  "/tasbih", "/zakat", "/settings", "/admin", "/admin/announcements", "/welcome",
];

for (const route of ROUTES) {
  test(`${route} renders without console errors`, async ({ page, appErrors, consoleEntries }) => {
    const res = await visit(page, route);
    expect(res?.status()).toBe(200);
    // /admin/announcements has no heading for a signed-out visitor (just the "sign in" sentence, as before).
    const heading = page
      .locator(route === "/admin/announcements" ? "main p" : "main h1, main h2, main [data-slot=card-title], h1")
      .first();
    await expect(heading).toBeVisible();
    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });
}

for (const bad of ["/quran/999", "/quran/0", "/quran/abc"]) {
  test(`${bad} is a 404 page`, async ({ page }) => {
    const res = await visit(page, bad);
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/পাতা পাওয়া যায়নি|Page not found/).first()).toBeVisible();
    // Inside the app shell (Figma D10): the tab bar stays, with one way back to Today.
    await expect(page.getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /আজকের পাতায় যান|Go to Today/ })).toHaveAttribute("href", "/today");
    expect(await page.content()).not.toMatch(LEAK);
  });
}

test("an unknown path is a 404 with its own tab title (#57)", async ({ page }) => {
  const res = await visit(page, "/nope-404");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle(/^(পাতা পাওয়া যায়নি|Page not found) — /);
});

test("/signup redirects to the one sign-up page (#57)", async ({ page }) => {
  await visit(page, "/signup");
  await expect(page).toHaveURL(/\/sign-up\/?$/);
});

// Hadith is switched off (src/config/features.ts): no menu links to it and its URLs show the calm coming-soon page.
test("/hadith and its sub-routes show the coming-soon page, noindex, and nothing links to them", async ({ page }) => {
  for (const path of ["/hadith", "/hadith/bukhari", "/hadith/nope/does-not-exist-x"]) {
    const res = await visit(page, path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByTestId("coming-soon")).toBeVisible();
    await expect(page.getByTestId("coming-soon")).toContainText("শিগগিরই আসছে");
    expect(await page.locator('meta[name="robots"]').last().getAttribute("content")).toMatch(/noindex/);
    expect(await page.content()).not.toMatch(LEAK);
  }
  await visit(page, "/today");
  await expect(page.locator('a[href^="/hadith"]')).toHaveCount(0);
});

for (const path of ["/books", "/quiz"]) {
  test(`${path} is a coming-soon page that no menu lists`, async ({ page }) => {
    await visit(page, path);
    await expect(page.getByTestId("coming-soon")).toBeVisible();
    await visit(page, "/today");
    await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
  });
}

test("/dashboard redirects permanently to /today", async ({ page, request }) => {
  const res = await request.get("/dashboard", { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toMatch(/\/today$/);
  await visit(page, "/dashboard");
  await expect(page).toHaveURL(/\/today$/);
});

test("guest plan data persists across a reload (localStorage)", async ({ page }) => {
  // The salah tracker (on /plan since the Home was focused) toggles the five prayers: filled = done.
  await visit(page, "/plan");
  const fajr = page.getByRole("group", { name: /নামাজ ট্র্যাকার|Salah Tracker/ }).getByRole("button", { name: /^(ফজর|Fajr)$/ });
  await fajr.waitFor({ state: "visible", timeout: 15_000 });
  const before = (await fajr.getAttribute("aria-pressed")) === "true";
  await fajr.click();
  await expect(fajr).toHaveAttribute("aria-pressed", String(!before));
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "load" });
  const fajr2 = page.getByRole("group", { name: /নামাজ ট্র্যাকার|Salah Tracker/ }).getByRole("button", { name: /^(ফজর|Fajr)$/ });
  await expect(fajr2).toHaveAttribute("aria-pressed", String(!before));
});
