import { test, expect, visit, HYDRATION, LEAK } from "./fixtures";

// Every page renders for a guest with the placeholder database: HTTP 200, a visible heading, no app console
// errors and no hydration warnings. (Promoted from the old scripts/smoke.mjs.)
const ROUTES = [
  "/", "/dashboard", "/today", "/plan", "/timetable", "/support", "/quran", "/reminders", "/duas", "/books", "/quiz",
  "/tasbih", "/zakat", "/settings", "/admin/announcements", "/welcome",
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
    expect(await page.content()).not.toMatch(LEAK);
  });
}

test("/hadith/<unknown> is a 404 or a controlled error, never raw database text", async ({ page }) => {
  const res = await visit(page, "/hadith/nope/does-not-exist-x");
  // Without a database the edition cannot be looked up: 503 with the error card (404 once a DB answers).
  expect([404, 503]).toContain(res?.status());
  expect(await page.content()).not.toMatch(LEAK);
});

test("/hadith without a database shows a controlled 503 message", async ({ page }) => {
  const res = await visit(page, "/hadith");
  expect(res?.status()).toBe(503);
  expect(await page.content()).not.toMatch(LEAK);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("hadith-load-error")).toBeVisible();
  await expect(page.getByRole("button", { name: /আবার চেষ্টা করুন|Try again/ })).toBeVisible();
  // Honest wording: no "fallback content" promise and no "no hadith found" after a failed load.
  await expect(page.locator("main")).not.toContainText(/বিকল্প কনটেন্ট|কোনো হাদিস পাওয়া যায়নি/);
});

test("client-side navigation to /hadith uses the server-function path and stays controlled", async ({ page, consoleEntries }) => {
  await visit(page, "/today");
  await page.locator('a[href="/hadith"]:visible').first().click();
  await page.waitForURL("**/hadith", { timeout: 15_000 });
  await page.getByText(/হাদিস পাঠ|Hadith/).first().waitFor({ state: "visible", timeout: 15_000 });
  const text = await page.locator("main").first().innerText();
  expect(text).not.toMatch(LEAK);
  expect(text).toMatch(/লোড করা যায়নি|couldn't load/i);
  expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
});

test("guest Today data persists across a reload (localStorage)", async ({ page }) => {
  // The salah tracker's prayers are toggle buttons (filled = done); the checklist below uses checkboxes. The exact
  // name skips the Home prayer list's bell ("ফজর রিমাইন্ডার"); the plan preview is empty for a new guest, so the
  // first checkbox is the dhikr checklist's.
  await visit(page, "/today");
  const fajr = page.getByRole("button", { name: /^(ফজর|Fajr)$/ }).first();
  await fajr.waitFor({ state: "visible", timeout: 15_000 });
  const done = async () => (await fajr.getAttribute("class"))?.includes("bg-primary text-primary-foreground") ?? false;
  const box = page.getByRole("checkbox").first();
  const before = await done();
  const boxBefore = await box.isChecked();
  await fajr.click();
  await box.click();
  await expect.poll(done).toBe(!before);
  await expect(box).toBeChecked({ checked: !boxBefore });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "load" });
  const fajr2 = page.getByRole("button", { name: /^(ফজর|Fajr)$/ }).first();
  await fajr2.waitFor({ state: "visible", timeout: 15_000 });
  await expect.poll(async () => (await fajr2.getAttribute("class"))?.includes("bg-primary text-primary-foreground") ?? false).toBe(!before);
  await expect(page.getByRole("checkbox").first()).toBeChecked({ checked: !boxBefore });
});
