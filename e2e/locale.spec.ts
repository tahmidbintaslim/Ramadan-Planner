import { test, expect, visit, prepareContext, HYDRATION } from "./fixtures";

// Bengali is the default; the NEXT_LOCALE cookie switches to English. The same element must render different
// text in each locale (Bengali script for bn), with no hydration warnings either way.
for (const path of ["/", "/today"]) {
  test(`locale cookie flips ${path} between bn and en`, async ({ browser, baseURL }) => {
    const texts: Record<string, string> = {};
    for (const appLocale of ["bn", "en"] as const) {
      const context = await browser.newContext();
      await prepareContext(context, baseURL!, appLocale);
      const page = await context.newPage();
      const hydration: string[] = [];
      page.on("console", (m) => { if (HYDRATION.test(m.text())) hydration.push(m.text()); });
      await visit(page, path);
      await expect(page.locator("html")).toHaveAttribute("lang", appLocale);
      texts[appLocale] = (await page.locator("main").first().innerText()).slice(0, 200);
      expect(hydration).toEqual([]);
      await context.close();
    }
    expect(texts.en).not.toBe(texts.bn);
    expect(texts.bn).toMatch(/[ঀ-৿]/);
    expect(texts.en).toMatch(/[a-z]{3}/i);
  });
}

test.describe("first visit, no locale cookie", () => {
  test.use({ appLocale: undefined, locale: "en-US" });

  test("Bangladesh gets Bengali even with an English browser", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-vercel-ip-country": "BD" });
    await visit(page, "/");
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  });

});

test.describe("first visit abroad, no locale cookie", () => {
  // The browser locale sets Accept-Language (an extra header cannot override it).
  test.use({ appLocale: undefined, locale: "th-TH", extraHTTPHeaders: { "x-vercel-ip-country": "TH" } });

  test("a Thai browser in Thailand gets English", async ({ page }) => {
    await visit(page, "/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
