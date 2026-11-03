import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/server/site-url";
import { ROBOTS_HEADERS, robotsTxt, seoBaseUrl } from "@/server/seo-files";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => new Response(robotsTxt(seoBaseUrl(getSiteUrl())), { headers: ROBOTS_HEADERS }),
    },
  },
});
