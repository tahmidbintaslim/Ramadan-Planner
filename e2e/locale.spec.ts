import { test, expect, visit, HYDRATION } from "./fixtures";

// Bengali is the default; the NEXT_LOCALE cookie switches to English. No hydration warnings either way.
for (const path of ["/", "/today"]) {
  test.describe(`locale ${path}`, () => {
    for (const appLocale of ["bn", "en"] as const) {
      test.describe(appLocale, () => {
        test.use({ appLocale });
        test(`renders html lang=${appLocale}`, async ({ page, consoleEntries }) => {
          await visit(page, path);
          await expect(page.locator("html")).toHaveAttribute("lang", appLocale);
          const text = (await page.locator("main").first().innerText()).slice(0, 200);
          if (appLocale === "bn") expect(text).toMatch(/[ঀ-৿]/);
          else expect(text).toMatch(/[a-z]{3}/i);
          expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
        });
      });
    }
  });
}

test("no cookie renders Bengali", async ({ page }) => {
  await visit(page, "/");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});
