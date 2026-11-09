import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { TimetableScreen } from "@/components/timetable/timetable-screen";
import { prefetchTimetable } from "@/lib/prefetch-app-data";
import { getDefaultTimetable } from "@/actions/timetable";

// Public and in the sitemap: overrides the `_app` noindex like /quran does. The server render carries the default
// (Dhaka) timetable, so crawlers and first paint see real times; the client then shows the visitor's own place.
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
  // Server render: the Dhaka rows. Client navigation: warm the shared data cache on link intent and never block.
  loader: async () => {
    if (typeof window !== "undefined") {
      prefetchTimetable();
      return { initial: null };
    }
    return { initial: await getDefaultTimetable() };
  },
  component: function TimetableRoute() {
    return <TimetableScreen initial={Route.useLoaderData().initial} />;
  },
});
