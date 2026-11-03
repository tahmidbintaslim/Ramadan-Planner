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
  const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(locs).toHaveLength(4 + 114);
  expect(locs.slice(0, 4)).toEqual(["/", "/quran", "/hadith", "/timetable"]);
});

test("favicon is served from public/", async ({ request }) => {
  const res = await request.get("/favicon.ico");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/icon/);
});

test("landing and /quran are indexable; signed-in pages are noindex", async ({ page }) => {
  await visit(page, "/");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.ico");
  await visit(page, "/quran");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await visit(page, "/timetable");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await visit(page, "/today");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
