import { test, expect, visit } from "./fixtures";

test("robots.txt disallows /api/ and points at the sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^text\/plain/);
  const body = await res.text();
  expect(body).toContain("Disallow: /api/");
  expect(body).toMatch(/^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/m);
});

test("sitemap.xml lists the public pages and 114 surahs", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^application\/xml/);
  const urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].replace(/&amp;/g, "&")));
  // Each page twice: Bengali (bare) and English (?lang=en).
  expect(urls).toHaveLength((6 + 114) * 2);
  const bn = urls.filter((u) => !u.search).map((u) => u.pathname);
  // /hadith is switched off (src/config/features.ts) until it works; /duas and /zakat are public.
  expect(bn.slice(0, 6)).toEqual(["/", "/quran", "/timetable", "/support", "/duas", "/zakat"]);
  expect(urls.filter((u) => u.search === "?lang=en")).toHaveLength(120);
});

test("favicon is served from public/", async ({ request }) => {
  const res = await request.get("/favicon.ico");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/icon/);
  const svg = await request.get("/favicon.svg");
  expect(svg.status()).toBe(200);
  expect(svg.headers()["content-type"]).toMatch(/image\/svg\+xml/);
});

test("landing and /quran are indexable; signed-in pages are noindex", async ({ page }) => {
  await visit(page, "/");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"][sizes="any"]')).toHaveAttribute("href", "/favicon.ico");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "/favicon.svg");
  await visit(page, "/quran");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await visit(page, "/timetable");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await visit(page, "/today");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

// The canonical/hreflang tags need SITE_URL (unset in e2e); src/lib/seo.test.ts covers them.
test("an English URL renders English, and stays English on navigation", async ({ page }) => {
  await visit(page, "/duas?lang=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Duas/);
  // The choice is remembered: a plain URL afterwards is still English.
  await visit(page, "/timetable");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

// The rows themselves come from AlAdhan at render time (an external service), so only the error text is asserted.
test("the timetable's server HTML never carries the 'could not load' error text", async ({ request }) => {
  const html = await (await request.get("/timetable")).text();
  const main = html.replace(/<script[\s\S]*?<\/script>/g, "").match(/<main[\s\S]*<\/main>/)?.[0] ?? "";
  expect(main).toContain("সময়সূচি");
  expect(main).not.toContain("লোড করা যায়নি");
});

test("the zakat calculator is indexable with its own title", async ({ page }) => {
  await visit(page, "/zakat");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page).toHaveTitle(/যাকাত হিসাব|Zakat calculator/);
});
