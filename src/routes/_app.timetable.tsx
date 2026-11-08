import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { TimetableScreen } from "@/components/timetable/timetable-screen";
import { prefetchTimetable } from "@/lib/prefetch-app-data";

// Public and in the sitemap: overrides the `_app` noindex like /quran does. The timetable itself is fetched on the
// client (/api/ramadan-timetable) for the visitor's time zone; the title and description are what crawlers index.
export const Route = createFileRoute("/_app/timetable")({
  head: ({ matches }) => {
    const root = rootData(matches);
    const h = pageHead({
      matches,
      title: msg(root, "timetablePage", "metaTitle", "Ramadan timetable"),
      description: msg(root, "timetablePage", "metaDescription"),
      canonicalPath: "/timetable",
    });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  // Warms the shared data cache on link intent (hover, touchstart, focus); never blocks navigation.
  loader: prefetchTimetable,
  component: TimetableScreen,
});
