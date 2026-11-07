// Server-only implementation of the /quran/$surah page loader (src/actions/quran-page.ts). PUBLIC read: the old
// page had no auth. Only what head() needs is returned; the reader component fetches the ayahs itself.
import "@tanstack/react-start/server-only";
import { fetchSurah, type SurahDetail } from "@/lib/quran";
import { getSiteUrl } from "@/server/site-url";

export interface SurahPageData {
  surahNumber: number;
  /** Null when the surah could not be loaded (DB and external API both failed): head() falls back to "Surah N". */
  surah: { surahNo: number; nameEnglish: string; nameBengali: string; totalAyah: number } | null;
  /** Public origin without trailing slash, "" when not configured. */
  siteUrl: string;
  /** The surah's text without audio URLs, so the server renders the ayahs (SEO); the client then loads audio. */
  text: SurahDetail | null;
}

export function isSurahNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 114;
}

/** `null` for a surah number outside 1..114 (the loader turns that into notFound()). */
export async function getSurahPageDataImpl(surahNumber: number): Promise<SurahPageData | null> {
  if (!isSurahNumber(surahNumber)) return null;
  const surah = await fetchSurah(surahNumber);
  return {
    surahNumber,
    surah: surah
      ? {
          surahNo: surah.surahNo,
          nameEnglish: surah.nameEnglish,
          nameBengali: surah.nameBengali,
          totalAyah: surah.totalAyah,
        }
      : null,
    siteUrl: getSiteUrl(),
    text: surah
      ? {
          ...surah,
          audio: {},
          ayahs: surah.ayahs.map(({ ayahNo, textArabic, textArabicClean, textEnglish, textBengali }) => ({
            ayahNo,
            textArabic,
            textArabicClean,
            textEnglish,
            textBengali,
            audio: {},
          })),
        }
      : null,
  };
}
