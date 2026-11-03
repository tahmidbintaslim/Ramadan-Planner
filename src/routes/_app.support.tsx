import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { SupportPage } from "@/components/support/support-page";

// Public and indexable (and in the sitemap): it is the project's open appeal, with no personal data on it.
// Overrides the `_app` noindex like /quran and /timetable do.
export const Route = createFileRoute("/_app/support")({
  head: ({ matches }) => {
    const root = rootData(matches);
    const h = pageHead({
      matches,
      title: msg(root, "supportPage", "metaTitle", "Sadaqah & contribute"),
      description: msg(root, "supportPage", "metaDescription"),
      canonicalPath: "/support",
    });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: () => <SupportPage />,
});
