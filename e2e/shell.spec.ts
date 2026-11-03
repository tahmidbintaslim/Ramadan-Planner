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
  test("the Quran audio bar floats above the bottom nav without overlapping it (390 and 800px)", async ({ page }) => {
    // The surah arrives from /api/quran on the client; answer it locally so no third-party API is needed.
    const ayah = (n: number) => ({
      ayahNo: n, textArabic: "بِسْمِ ٱللَّهِ", textArabicClean: "بسم الله", textEnglish: "In the name of Allah",
      textBengali: "আল্লাহর নামে", audio: { "1": { reciter: "R", url: "data:,", originalUrl: "data:," } },
    });
    await page.route(/\/api\/quran\?surah=1$/, (r) =>
      r.fulfill({
        json: {
          surahNo: 1, nameArabic: "الفاتحة", nameArabicLong: "سورة الفاتحة", nameEnglish: "Al-Faatiha",
          nameTranslation: "The Opening", nameBengali: "আল-ফাতিহা", revelationPlace: "Mecca", totalAyah: 7,
          audio: {}, ayahs: Array.from({ length: 7 }, (_, i) => ayah(i + 1)),
        },
      }),
    );
    await page.route(/\/api\/quran\?reciters=true$/, (r) => r.fulfill({ json: [{ id: 1, name: "R" }] }));
    // 390px phone and 800px tablet: both have the floating bottom nav (it goes at 1024px).
    for (const width of [390, 800]) {
      await page.setViewportSize({ width, height: 844 });
      await visit(page, "/quran/1");
      const bar = page.locator("[data-quran-audio-bar]");
      await expect(bar).toBeVisible({ timeout: 15_000 });
      const nav = page.getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ }).first();
      const [b, n] = [await bar.boundingBox(), await nav.boundingBox()];
      expect(b && n).toBeTruthy();
      expect(b!.y + b!.height).toBeLessThanOrEqual(n!.y);
      // ...and leaves room for the accessibility button on its right.
      const fab = (await page.getByRole("button", { name: /অ্যাক্সেসিবিলিটি|Accessibility/ }).boundingBox())!;
      expect(b!.x + b!.width).toBeLessThanOrEqual(fab.x);
      // The last ayah can be scrolled clear of the floating bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastAyah = page.locator("main [dir=rtl]").last();
      const a = await lastAyah.boundingBox();
      expect(a!.y + a!.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
    }
  });
});

test("desktop side nav replaces the bottom nav and marks the active item", async ({ page }) => {
  await visit(page, "/quran");
  const side = page.locator("aside nav");
  await expect(side).toBeVisible();
  await expect(side.locator('a[href="/quran"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("nav.fixed").first()).toBeHidden();
});

test.describe("accessibility panel", () => {
  const A11Y = /^(অ্যাক্সেসিবিলিটি|Accessibility)$/;

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("no floating button in the app shell; font size and theme live in the More sheet", async ({ page }) => {
      await visit(page, "/today");
      await expect(page.getByRole("button", { name: A11Y })).toHaveCount(0);
      await page
        .getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ })
        .first()
        .getByRole("button", { name: /আরও|More/ })
        .click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("heading", { name: A11Y })).toBeVisible();
      await sheet.getByRole("button", { name: /ফন্ট বড় করুন|Increase font size/ }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe("105%");
      await sheet.getByRole("button", { name: /^(অটো|Auto)$/ }).click();
      await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("auto");
      // The stored size applies after a reload too.
      await page.reload({ waitUntil: "load" });
      await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe("105%");
    });

    test("pages outside the shell keep the floating button", async ({ page }) => {
      await visit(page, "/");
      await expect(page.getByRole("button", { name: A11Y })).toBeVisible();
    });
  });

  test("desktop side-nav footer opens the accessibility dialog", async ({ page }) => {
    await visit(page, "/today");
    const trigger = page.locator("aside").getByRole("button", { name: A11Y });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: A11Y });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^(ডার্ক|Dark)$/ }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });
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
