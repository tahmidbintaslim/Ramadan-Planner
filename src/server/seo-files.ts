// robots.txt and sitemap.xml bodies. Ported from src/app/robots.txt/route.ts and src/app/sitemap.xml/route.ts
// (same URLs, same lines, same whitespace). Pure functions so tests can pin the output.

/** Old order: NEXT_PUBLIC_SITE_URL, then https://VERCEL_PROJECT_PRODUCTION_URL, then http://localhost:3000.
 *  `siteUrl` is getSiteUrl() ("" when unset), which also honours SITE_URL and strips trailing slashes. */
let warnedLocalhostFallback = false;

export function seoBaseUrl(siteUrl: string): string {
  if (siteUrl) return siteUrl;
  // A production robots.txt/sitemap.xml pointing at localhost is invisible to crawlers: say so once per process.
  if (process.env.NODE_ENV === "production" && !warnedLocalhostFallback) {
    warnedLocalhostFallback = true;
    console.warn(
      "[seo] SITE_URL (or NEXT_PUBLIC_SITE_URL / VERCEL_PROJECT_PRODUCTION_URL) is not set; robots.txt and sitemap.xml use http://localhost:3000",
    );
  }
  return "http://localhost:3000";
}

/** Test hook: lets the once-per-process warning fire again. */
export function resetSeoBaseUrlWarning(): void {
  warnedLocalhostFallback = false;
}

/** Escape text for an XML element body (the base URL comes from an env var). */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function robotsTxt(baseUrl: string): string {
  return ["User-agent: *", "Allow: /", "Disallow: /api/", `Sitemap: ${baseUrl}/sitemap.xml`].join("\n") + "\n";
}

// Public pages only. The Next sitemap also listed the signed-in noindex pages /plan, /today, /reminders,
// /settings; they were dropped deliberately (Task 10 fix round 1).
export const SITEMAP_STATIC_PAGES = ["/", "/quran", "/hadith", "/timetable", "/support"];
export const SURAH_COUNT = 114;

/** Every path the sitemap lists, in order (static pages, then /quran/1..114). */
export function sitemapPaths(): string[] {
  const paths = [...SITEMAP_STATIC_PAGES];
  for (let i = 1; i <= SURAH_COUNT; i++) paths.push(`/quran/${i}`);
  return paths;
}

export function sitemapXml(baseUrl: string): string {
  const base = xmlEscape(baseUrl);
  const urls = sitemapPaths().map((p) => `<url><loc>${base}${p}</loc></url>`);
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
