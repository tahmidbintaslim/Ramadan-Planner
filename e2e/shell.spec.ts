import { test, expect, visit } from "./fixtures";

// App shell (design system v2, Task 6): floating bottom nav and More sheet on phones, side nav on desktop,
// aria-current on the active destination, content clear of the bottom nav, and Auto Night.

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom nav marks the active tab and the More sheet lists the other routes", async ({ page }) => {
    await visit(page, "/today");
    const nav = page.getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ }).first();
    await expect(nav).toBeVisible();
    await expect(nav.locator('a[href="/today"]')).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('a[href="/plan"]')).not.toHaveAttribute("aria-current", "page");

    await nav.getByRole("button", { name: /আরও|More/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    for (const href of ["/duas", "/tasbih", "/zakat", "/hadith", "/reminders", "/settings", "/books", "/quiz", "/dashboard"]) {
      await expect(sheet.locator(`a[href="${href}"]`)).toBeVisible();
    }
    await sheet.locator('a[href="/duas"]').click();
    await page.waitForURL("**/duas");
    await expect(sheet).toBeHidden();
  });

  test("the bottom nav never covers the end of a long page", async ({ page }) => {
    await visit(page, "/duas");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const navTop = await page
      .getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ })
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    const contentBottom = await page.locator("main").evaluate((main) => {
      // The lowest visible box inside <main> (its padding is the clearance itself).
      let bottom = 0;
      for (const el of Array.from(main.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.width > 0) bottom = Math.max(bottom, r.bottom);
      }
      return bottom;
    });
    expect(contentBottom).toBeLessThanOrEqual(navTop);
  });
});

test("desktop side nav replaces the bottom nav and marks the active item", async ({ page }) => {
  await visit(page, "/quran");
  const side = page.locator("aside nav");
  await expect(side).toBeVisible();
  await expect(side.locator('a[href="/quran"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("nav.fixed").first()).toBeHidden();
});

test.describe("Auto Night", () => {
  test.use({ timezoneId: "Asia/Dhaka" });

  for (const [hour, dark] of [[22, true], [12, false]] as const) {
    test(`theme "auto" at ${hour}:00 is ${dark ? "Night" : "Light"}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(`2027-02-20T${String(hour).padStart(2, "0")}:00:00+06:00`));
      await page.addInitScript(() => localStorage.setItem("theme", "auto"));
      await visit(page, "/today");
      const html = page.locator("html");
      if (dark) await expect(html).toHaveClass(/\bdark\b/);
      else await expect(html).not.toHaveClass(/\bdark\b/);
      const colors = () =>
        page.evaluate(() => Array.from(document.querySelectorAll('meta[name="theme-color"]'), (m) => m.getAttribute("content")));
      await expect.poll(async () => [...new Set(await colors())]).toEqual([dark ? "#0B1F24" : "#F3F8F6"]);
    });
  }
});
