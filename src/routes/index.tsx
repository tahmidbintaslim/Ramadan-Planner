import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { msg, pageHead, rootData, safeJsonLd, webApplicationJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  // The server's year for the footer, so the hydrating render matches the server HTML (see useFooterYear).
  // The render time too, so the server and hydrating renders share one clock (see useNowTick).
  loader: () => ({ serverYear: new Date().getFullYear(), now: Date.now() }),
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
  component: LandingRoute,
});

function LandingRoute() {
  const { serverYear, now } = Route.useLoaderData();
  return <LandingPage serverYear={serverYear} initialNow={new Date(now)} />;
}
