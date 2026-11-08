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
  expect(locs).toHaveLength(5 + 114);
  // /hadith is switched off (src/config/features.ts) until it works; /duas is public.
  expect(locs.slice(0, 5)).toEqual(["/", "/quran", "/timetable", "/support", "/duas"]);
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
