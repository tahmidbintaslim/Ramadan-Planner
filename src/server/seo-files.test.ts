import { afterEach, describe, expect, it, vi } from "vitest";
import { robotsTxt, seoBaseUrl, sitemapXml, xmlEscape, resetSeoBaseUrlWarning, SITEMAP_HEADERS, ROBOTS_HEADERS } from "./seo-files";
import { getSiteUrl } from "./site-url";

// Copy of the logic in the deleted src/app/robots.txt/route.ts and src/app/sitemap.xml/route.ts, with the two
// deliberate changes: `Disallow: /api/` and no /plan /today /reminders /settings (signed-in, noindex).
function oldBase(env: Record<string, string | undefined>) {
  return (
    env.NEXT_PUBLIC_SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  );
}
function oldRobots(baseUrl: string) {
  return ["User-agent: *", "Allow: /", "Disallow: /api/", `Sitemap: ${baseUrl}/sitemap.xml`].join("\n") + "\n";
}
function oldSitemap(baseUrl: string) {
  // /timetable and /support are new in design system v2 (Tasks 8 and 10).
  const staticPages = ["/", "/quran", "/hadith", "/timetable", "/support"];
  const urls: string[] = [];
  for (const p of staticPages) urls.push(`<url><loc>${baseUrl}${p}</loc></url>`);
  for (let i = 1; i <= 114; i++) urls.push(`<url><loc>${baseUrl}/quran/${i}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join("\n")}
  </urlset>`;
}

afterEach(() => vi.unstubAllEnvs());

describe("robots.txt / sitemap.xml match the Next routes (plus the two deliberate changes)", () => {
  it.each([
    ["https://ramadan.example", ""],
    ["", "ramadan-planner.vercel.app"],
    ["", ""],
  ])("same bytes for NEXT_PUBLIC_SITE_URL=%s VERCEL_PROJECT_PRODUCTION_URL=%s", (pub, vercel) => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", pub);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", vercel);
    const base = seoBaseUrl(getSiteUrl());
    const expected = oldBase({ NEXT_PUBLIC_SITE_URL: pub, VERCEL_PROJECT_PRODUCTION_URL: vercel });
    expect(base).toBe(expected);
    expect(robotsTxt(base)).toBe(oldRobots(expected));
    expect(sitemapXml(base)).toBe(oldSitemap(expected));
  });

  it("SITE_URL wins (canonical URLs use it) and a trailing slash is dropped", () => {
    vi.stubEnv("SITE_URL", "https://site.example/");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://other.example");
    const base = seoBaseUrl(getSiteUrl());
    expect(robotsTxt(base)).toContain("Sitemap: https://site.example/sitemap.xml\n");
    expect(sitemapXml(base)).toContain("<loc>https://site.example/quran/114</loc>");
    expect(sitemapXml(base)).not.toContain("other.example");
  });
});

describe("sitemap content", () => {
  const xml = sitemapXml("https://x.test");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("https://x.test", ""));

  it("lists the public pages and surahs 1..114 exactly once", () => {
    expect(locs).toHaveLength(5 + 114);
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs).toEqual(expect.arrayContaining(["/", "/quran", "/hadith", "/timetable", "/support", "/quran/1", "/quran/114"]));
    expect(locs).not.toContain("/quran/0");
    expect(locs).not.toContain("/quran/115");
  });

  it("never lists API, auth, admin, or other signed-in-only routes", () => {
    const forbidden = ["/api", "/sign-in", "/sign-up", "/signup", "/login", "/forgot", "/admin", "/dashboard", "/books", "/duas", "/quiz", "/tasbih", "/zakat"];
    for (const f of forbidden) expect(locs.some((l) => l.startsWith(f))).toBe(false);
  });

  it("does not list the signed-in noindex pages /plan /today /reminders /settings", () => {
    for (const p of ["/plan", "/today", "/reminders", "/settings"]) {
      expect(locs).not.toContain(p);
      expect(xml).not.toContain(`x.test${p}<`);
    }
  });

  it("has an XML declaration and urlset namespace", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});

describe("robots.txt content", () => {
  it("allows the site, disallows /api/ and points at the sitemap", () => {
    const txt = robotsTxt("https://x.test");
    expect(txt).toBe("User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://x.test/sitemap.xml\n");
    expect(txt.split("\n")).toContain("Disallow: /api/");
  });
});

it("serves the right content types and caching", () => {
  expect(ROBOTS_HEADERS["Content-Type"]).toBe("text/plain; charset=utf-8");
  expect(ROBOTS_HEADERS["Cache-Control"]).toBe("public, max-age=0, s-maxage=3600");
  expect(SITEMAP_HEADERS["Content-Type"]).toBe("application/xml");
  expect(SITEMAP_HEADERS["Cache-Control"]).toBe("public, max-age=0, s-maxage=3600");
});

describe("base URL safety", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetSeoBaseUrlWarning();
  });

  it("XML-escapes the base URL inside <loc>", () => {
    expect(xmlEscape(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;");
    const xml = sitemapXml("https://x.test/?a=1&b=<2>");
    expect(xml).toContain("<loc>https://x.test/?a=1&amp;b=&lt;2&gt;/quran</loc>");
    expect(xml).not.toContain("&b=<2>");
  });

  it("warns once in production when falling back to localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(seoBaseUrl("")).toBe("http://localhost:3000");
    expect(seoBaseUrl("")).toBe("http://localhost:3000");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/SITE_URL/);
  });

  it("does not warn outside production or when a site URL is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    seoBaseUrl("");
    vi.stubEnv("NODE_ENV", "production");
    expect(seoBaseUrl("https://site.example")).toBe("https://site.example");
    expect(warn).not.toHaveBeenCalled();
  });
});
