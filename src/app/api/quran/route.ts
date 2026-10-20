import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CACHE_LONG = "public, s-maxage=604800, stale-while-revalidate=2592000";
const NO_STORE = "no-store";

// The Quran service already falls back to the external API when the DB is
// empty or unreachable. These responses cover the case where both fail; they
// are never cached so the next request retries.
function unavailable(message: string) {
    return NextResponse.json(
        { ok: false, error: { code: "unavailable", message } },
        { status: 503, headers: { "Cache-Control": NO_STORE } },
    );
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const surahNumber = searchParams.get("surah");
    const recitersOnly = searchParams.get("reciters");

    try {
        // Lazy import to avoid PrismaClient instantiation at build time
        const { fetchSurahList, fetchSurah, fetchReciters } = await import("@/lib/quran");

        // GET /api/quran?reciters=true → reciter list
        if (recitersOnly === "true") {
            const data = await fetchReciters();
            if (data.length === 0) {
                return unavailable("Reciter list is temporarily unavailable");
            }
            return NextResponse.json(data, {
                headers: { "Cache-Control": CACHE_LONG },
            });
        }

        // GET /api/quran?surah=N → full surah with ayahs
        if (surahNumber) {
            const num = parseInt(surahNumber, 10);
            if (isNaN(num) || num < 1 || num > 114) {
                return NextResponse.json(
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
            return NextResponse.json(data, {
                headers: { "Cache-Control": CACHE_LONG },
            });
        }

        // GET /api/quran → surah list (metadata)
        const data = await fetchSurahList();
        if (data.length === 0) {
            return unavailable("Surah list is temporarily unavailable");
        }
        return NextResponse.json(data, {
            headers: { "Cache-Control": CACHE_LONG },
        });
    } catch (error) {
        console.error("[api/quran] unexpected error", error);
        return unavailable("Quran data is temporarily unavailable");
    }
}
