import { createFileRoute, notFound } from "@tanstack/react-router";
import { getSurahPageData } from "@/actions/quran-page";
import { QuranReader } from "@/components/quran/quran-reader";
import { pageHead, rootData } from "@/lib/seo";
import { formatLocalizedNumber } from "@/lib/locale-number";

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
  head: ({ loaderData, matches }) => {
    if (!loaderData) return {};
    const { surahNumber, surah } = loaderData;
    if (!surah) {
      // No surah row: keep the `_app` noindex and skip the canonical.
      return pageHead({ matches, fullTitle: `Surah ${surahNumber}`, description: `Surah ${surahNumber}` });
    }
    // One script per title: Bengali names and digits in bn, English in en (search snippets show these).
    const en = rootData(matches)?.locale === "en";
    const num = (v: number) => formatLocalizedNumber(v, en ? "en" : "bn");
    const h = pageHead({
      matches,
      fullTitle: en ? `${surah.nameEnglish} — Surah ${surah.surahNo}` : `${surah.nameBengali} — সূরা ${num(surah.surahNo)}`,
      description: en
        ? `${surah.nameEnglish} (${surah.nameBengali}) — ${surah.totalAyah} ayahs`
        : `${surah.nameBengali} (${surah.nameEnglish}) — ${num(surah.totalAyah)} আয়াত`,
      canonicalPath: `/quran/${surahNumber}`,
    });
    // Overrides the `_app` noindex (the old page did the same): surah pages are public and in the sitemap.
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: SurahRoute,
});

function SurahRoute() {
  const { surahNumber, text } = Route.useLoaderData();
  return <QuranReader key={surahNumber} surahNumber={surahNumber} initialText={text} />;
}
