// Loader server function for /quran/$surah. PUBLIC read (no authMiddleware: the old page had no auth). The
// body is server-only (src/server/quran-impl.ts); the global error mask still applies to it.
import { createServerFn } from "@tanstack/react-start";
import { getSurahPageDataImpl } from "@/server/quran-impl";
import type { SurahPageData } from "@/server/quran-impl";

export type { SurahPageData } from "@/server/quran-impl";

const getSurahPageDataFn = createServerFn({ method: "GET" })
  .validator((surahNumber: unknown) => surahNumber as number)
  .handler(({ data }) => getSurahPageDataImpl(data));

/** `null` when `surahNumber` is not an integer in 1..114. */
export async function getSurahPageData(surahNumber: number): Promise<SurahPageData | null> {
  return getSurahPageDataFn({ data: surahNumber });
}
