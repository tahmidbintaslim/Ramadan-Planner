import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/landing/site-pages";
import { msg, pageHead, rootData } from "@/lib/seo";

// Public site page (outside the app shell): indexable, in the sitemap, with its own title and description.
export const Route = createFileRoute("/pricing")({
  // The server's year for the footer, so the hydrating render matches the server HTML (see useFooterYear).
  loader: () => ({ serverYear: new Date().getFullYear() }),
  head: ({ matches }) => {
    const root = rootData(matches);
    return pageHead({
      matches,
      canonicalPath: "/pricing",
      title: msg(root, "marketing", "pricingMetaTitle", "Pricing"),
      description: msg(root, "marketing", "pricingMetaDescription"),
    });
  },
  component: function PricingRoute() {
    return <PricingPage serverYear={Route.useLoaderData().serverYear} />;
  },
});
