import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/components/landing/site-pages";
import { msg, pageHead, rootData } from "@/lib/seo";

// Public site page: indexable and in the sitemap. The app stores link here as the privacy policy URL.
export const Route = createFileRoute("/privacy")({
  loader: () => ({ serverYear: new Date().getFullYear() }),
  head: ({ matches }) => {
    const root = rootData(matches);
    return pageHead({
      matches,
      canonicalPath: "/privacy",
      title: msg(root, "privacy", "title", "Privacy"),
      description: msg(root, "privacy", "metaDescription"),
    });
  },
  component: function PrivacyRoute() {
    return <PrivacyPage serverYear={Route.useLoaderData().serverYear} />;
  },
});
