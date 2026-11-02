import { createFileRoute, notFound } from "@tanstack/react-router";
import { getSurahPageData } from "@/actions/quran-page";
import { QuranReader } from "@/components/quran/quran-reader";

// Port of src/app/(app)/quran/[surah]/page.tsx. `parseInt` as before (so "12abc" still means 12).
function parseSurah(param: string): number | null {
  const n = parseInt(param, 10);
  return Number.isNaN(n) || n < 1 || n > 114 ? null : n;
}

export const Route = createFileRoute("/_app/quran/$surah")({
  loader: async ({ params }) => {
    const n = parseSurah(params.surah);
    if (n === null) throw notFound();
    const data = await getSurahPageData(n);
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { surahNumber, surah, siteUrl } = loaderData;
    if (!surah) {
      return {
        meta: [
          { title: `Surah ${surahNumber}` },
          { name: "description", content: `Surah ${surahNumber}` },
        ],
      };
    }
    const title = `${surah.nameEnglish} — সূরা ${surah.surahNo}`;
    const description = `${surah.nameBengali} (${surah.nameEnglish}) — ${surah.totalAyah} আয়াত`;
    const path = `/quran/${surahNumber}`;
    const pageUrl = siteUrl ? `${siteUrl}${path}` : path;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        // Overrides the `_app` noindex (the old page did the same): surah pages are public.
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: pageUrl },
        ...(siteUrl ? [{ property: "og:image", content: `${siteUrl}/og.png` }] : []),
      ],
      links: siteUrl ? [{ rel: "canonical", href: pageUrl }] : [],
    };
  },
  component: SurahRoute,
});

function SurahRoute() {
  const { surahNumber } = Route.useLoaderData();
  return <QuranReader surahNumber={surahNumber} />;
}
