// Server-only handler for GET /api/quran, ported from src/app/api/quran/route.ts.
import "@tanstack/react-start/server-only";
import { guarded, json } from "./http";

export const QURAN_CACHE_LONG = "public, s-maxage=604800, stale-while-revalidate=2592000";
const NO_STORE = "no-store";

// The Quran service already falls back to the external API when the DB is
// empty or unreachable. These responses cover the case where both fail; they
// are never cached so the next request retries.
function unavailable(message: string) {
  return json(
    { ok: false, error: { code: "unavailable", message } },
    { status: 503, headers: { "Cache-Control": NO_STORE } },
  );
}

export function handleQuran(request: Request): Promise<Response> {
  return guarded("api/quran", () => run(request));
}

async function run(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const surahNumber = searchParams.get("surah");
  const recitersOnly = searchParams.get("reciters");

  try {
    // Lazy import: a broken Prisma/DB config is caught below too
    const { fetchSurahList, fetchSurah, fetchReciters } = await import("@/lib/quran");

    // GET /api/quran?reciters=true → reciter list
    if (recitersOnly === "true") {
      const data = await fetchReciters();
      if (data.length === 0) {
        return unavailable("Reciter list is temporarily unavailable");
      }
      return json(data, { headers: { "Cache-Control": QURAN_CACHE_LONG } });
    }

    // GET /api/quran?surah=N → full surah with ayahs
    if (surahNumber) {
      const num = parseInt(surahNumber, 10);
      if (isNaN(num) || num < 1 || num > 114) {
        return json(
          {
            ok: false,
            error: {
              code: "invalid_surah",
              message: "Surah number must be between 1 and 114",
            },
          },
          { status: 400 },
        );
      }

      const data = await fetchSurah(num);
      if (!data) {
        return unavailable("Surah is temporarily unavailable");
      }
      return json(data, { headers: { "Cache-Control": QURAN_CACHE_LONG } });
    }

    // GET /api/quran → surah list (metadata)
    const data = await fetchSurahList();
    if (data.length === 0) {
      return unavailable("Surah list is temporarily unavailable");
    }
    return json(data, { headers: { "Cache-Control": QURAN_CACHE_LONG } });
  } catch (error) {
    console.error("[api/quran] unexpected error", error);
    return unavailable("Quran data is temporarily unavailable");
  }
}
