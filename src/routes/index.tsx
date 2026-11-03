import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { msg, pageHead, rootData, safeJsonLd, webApplicationJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: ({ matches }) => {
    const root = rootData(matches);
    // Landing title = the app name (common.metaTitle, same as before); canonical is the site root.
    return pageHead({
      matches,
      canonicalPath: "/",
      description: msg(root, "common", "metaDescription"),
      scripts: [{ type: "application/ld+json", children: safeJsonLd(webApplicationJsonLd(root)) }],
    });
  },
  component: LandingPage,
});
