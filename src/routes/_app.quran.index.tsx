import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { QuranSurahList } from "@/components/quran/quran-surah-list";
import { getSurahList } from "@/actions/quran-page";
import { fetchCached, SURAH_LIST_KEY } from "@/lib/data-cache";
import type { SurahInfo } from "@/lib/quran";

// `index` so the Task 6 sibling `_app.quran.$surah.tsx` does not turn this into a layout that needs an Outlet.
export const Route = createFileRoute("/_app/quran/")({
  // Public, in the sitemap: overrides the `_app` noindex like the surah pages do.
  head: ({ matches }) => {
    const h = pageHead({ matches, title: msg(rootData(matches), "nav", "quran", "Quran"), canonicalPath: "/quran" });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  // In the browser the shared data cache answers a revisit (and a link-intent preload) without a request.
  loader: () => (typeof window === "undefined" ? getSurahList() : fetchCached<SurahInfo[]>(SURAH_LIST_KEY, getSurahList).catch(() => [])),
  component: QuranListRoute,
});

function QuranListRoute() {
  return <QuranSurahList initialSurahs={Route.useLoaderData()} />;
}
