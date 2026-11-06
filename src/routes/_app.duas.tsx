import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { DuasPage } from "@/components/duas/duas-page";

// Public and in the sitemap (overrides the `_app` noindex like /timetable): the sourced Ramadan duas are static.
export const Route = createFileRoute("/_app/duas")({
  head: ({ matches }) => {
    const root = rootData(matches);
    const h = pageHead({
      matches,
      title: msg(root, "duas", "metaTitle", "Ramadan duas"),
      description: msg(root, "duas", "metaDescription"),
      canonicalPath: "/duas",
    });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: DuasPage,
});
