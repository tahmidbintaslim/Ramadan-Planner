import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { QuranSurahList } from "@/components/quran/quran-surah-list";

// `index` so the Task 6 sibling `_app.quran.$surah.tsx` does not turn this into a layout that needs an Outlet.
export const Route = createFileRoute("/_app/quran/")({
  // Public, in the sitemap: overrides the `_app` noindex like the surah pages do.
  head: ({ matches }) => {
    const h = pageHead({ matches, title: msg(rootData(matches), "nav", "quran", "Quran"), canonicalPath: "/quran" });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: QuranSurahList,
});
