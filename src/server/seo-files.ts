// robots.txt and sitemap.xml bodies. Ported from src/app/robots.txt/route.ts and src/app/sitemap.xml/route.ts
// (same URLs, same lines, same whitespace). Pure functions so tests can pin the output.

/** Old order: NEXT_PUBLIC_SITE_URL, then https://VERCEL_PROJECT_PRODUCTION_URL, then http://localhost:3000.
 *  `siteUrl` is getSiteUrl() ("" when unset), which also honours SITE_URL and strips trailing slashes. */
export function seoBaseUrl(siteUrl: string): string {
  return siteUrl || "http://localhost:3000";
}

export function robotsTxt(baseUrl: string): string {
  return ["User-agent: *", "Allow: /", "Disallow: /api/", `Sitemap: ${baseUrl}/sitemap.xml`].join("\n") + "\n";
}

// Public pages only. The Next sitemap also listed the signed-in noindex pages /plan, /today, /reminders,
// /settings; they were dropped deliberately (Task 10 fix round 1).
export const SITEMAP_STATIC_PAGES = ["/", "/quran", "/hadith"];
export const SURAH_COUNT = 114;

export function sitemapXml(baseUrl: string): string {
  const urls: string[] = [];
  for (const p of SITEMAP_STATIC_PAGES) urls.push(`<url><loc>${baseUrl}${p}</loc></url>`);
  for (let i = 1; i <= SURAH_COUNT; i++) urls.push(`<url><loc>${baseUrl}/quran/${i}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join("\n")}
  </urlset>`;
}

export const ROBOTS_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600",
};
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml",
  "Cache-Control": "public, max-age=0, s-maxage=3600",
};
