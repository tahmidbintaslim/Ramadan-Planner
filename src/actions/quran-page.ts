// Loader server function for /quran/$surah. PUBLIC read (no authMiddleware: the old page had no auth). The
// body is server-only (src/server/quran-impl.ts); the global error mask still applies to it.
import { createServerFn } from "@tanstack/react-start";
import { getSurahPageDataImpl } from "@/server/quran-impl";
import type { SurahPageData } from "@/server/quran-impl";

export type { SurahPageData } from "@/server/quran-impl";

const getSurahPageDataFn = createServerFn({ method: "GET" })
  // Not a number -> NaN, which the Impl rejects (null) like any number outside 1..114.
  .validator((surahNumber: unknown) => (typeof surahNumber === "number" ? surahNumber : Number.NaN))
  .handler(({ data }) => getSurahPageDataImpl(data));

/** `null` when `surahNumber` is not an integer in 1..114. */
export async function getSurahPageData(surahNumber: number): Promise<SurahPageData | null> {
  return getSurahPageDataFn({ data: surahNumber });
}

const getSurahListFn = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchSurahList } = await import("@/lib/quran");
  try {
    return await fetchSurahList();
  } catch {
    return []; // the list then fetches /api/quran on the client, as before
  }
});

/** All 114 surahs for the /quran loader, so the list renders on the server; [] when the source fails. */
export async function getSurahList() {
  return getSurahListFn();
}
