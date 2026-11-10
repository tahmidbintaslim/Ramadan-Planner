import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "@/components/landing/site-pages";
import { msg, pageHead, rootData } from "@/lib/seo";

// Public site page (outside the app shell): indexable, in the sitemap, with its own title and description.
export const Route = createFileRoute("/features")({
  // The server's year for the footer, so the hydrating render matches the server HTML (see useFooterYear).
  loader: () => ({ serverYear: new Date().getFullYear() }),
  head: ({ matches }) => {
    const root = rootData(matches);
    return pageHead({
      matches,
      canonicalPath: "/features",
      title: msg(root, "marketing", "featuresMetaTitle", "Features"),
      description: msg(root, "marketing", "featuresMetaDescription"),
    });
  },
  component: function FeaturesRoute() {
    return <FeaturesPage serverYear={Route.useLoaderData().serverYear} />;
  },
});
