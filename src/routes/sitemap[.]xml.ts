import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/server/site-url";
import { SITEMAP_HEADERS, seoBaseUrl, sitemapXml } from "@/server/seo-files";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => new Response(sitemapXml(seoBaseUrl(getSiteUrl())), { headers: SITEMAP_HEADERS }),
    },
  },
});
