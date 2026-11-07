import { test, expect, visit } from "./fixtures";

// These need outbound HTTPS from the SERVER to quranapi.pages.dev and api.aladhan.com (third-party APIs), so
// they are opt-in: E2E_NETWORK=1. CI skips them to stay deterministic. (Promoted from the old scripts/smoke.mjs.)
test.skip(!process.env.E2E_NETWORK, "set E2E_NETWORK=1 to run checks that call third-party APIs");

const apiOk = (apis: { url: string; status: number }[], prefix: string) =>
  apis.find((a) => a.url.startsWith(prefix) && a.status === 200);

function trackApi(page: import("@playwright/test").Page, baseURL: string) {
  const apis: { url: string; status: number }[] = [];
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin === new URL(baseURL).origin && u.pathname.startsWith("/api/")) apis.push({ url: u.pathname + u.search, status: r.status() });
  });
  return apis;
}

test("/quran/1 has the surah title, is indexable and renders verses", async ({ page, baseURL }) => {
  const apis = trackApi(page, baseURL!);
  const res = await visit(page, "/quran/1");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/সূরা ১/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const verses = page.locator("main [dir=rtl].font-arabic");
  await expect(verses.nth(6)).toBeVisible({ timeout: 20_000 });
  expect(apiOk(apis, "/api/quran?surah=1")).toBeTruthy();
  expect(await verses.nth(1).innerText()).toMatch(/[؀-ۿ]{3,}/);
});

test("/quran surah list loads", async ({ page, baseURL }) => {
  const apis = trackApi(page, baseURL!);
  await visit(page, "/quran");
  await expect(page.getByText(/Al-Baqara|আল-বাকারা/).first()).toBeVisible();
  expect(apiOk(apis, "/api/quran")).toBeTruthy();
});

test("/today loads the Ramadan status", async ({ page, baseURL }) => {
  const apis = trackApi(page, baseURL!);
  await visit(page, "/today");
  expect(apiOk(apis, "/api/ramadan?"), "/api/ramadan?").toBeTruthy();
});
