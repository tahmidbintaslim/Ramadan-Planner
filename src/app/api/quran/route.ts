import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CACHE_LONG = "public, s-maxage=604800, stale-while-revalidate=2592000";
const CACHE_SHORT = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: NextRequest) {
    // Lazy import to avoid PrismaClient instantiation at build time
    const { fetchSurahList, fetchSurah, fetchReciters } = await import("@/lib/quran");

    const { searchParams } = request.nextUrl;
    const surahNumber = searchParams.get("surah");
    const recitersOnly = searchParams.get("reciters");

    try {
        // GET /api/quran?reciters=true → reciter list
        if (recitersOnly === "true") {
            const data = await fetchReciters();
            return NextResponse.json(data, {
                headers: { "Cache-Control": CACHE_LONG },
            });
        }

        // GET /api/quran?surah=N → full surah with ayahs
        if (surahNumber) {
            const num = parseInt(surahNumber, 10);
            if (isNaN(num) || num < 1 || num > 114) {
                return NextResponse.json(
                    { error: "Surah number must be between 1 and 114" },
                    { status: 400 },
                );
            }

            const data = await fetchSurah(num);
            if (!data) {
                return NextResponse.json(
                    { error: "Surah not found. Database may not be seeded yet." },
                    { status: 404 },
                );
            }
            return NextResponse.json(data, {
                headers: { "Cache-Control": CACHE_LONG },
            });
        }

        // GET /api/quran → surah list (metadata)
        const data = await fetchSurahList();
        return NextResponse.json(data, {
            headers: { "Cache-Control": CACHE_LONG },
        });
    } catch (error) {
        console.error("Quran API error:", error);
        return NextResponse.json([], {
            status: 200,
            headers: { "Cache-Control": CACHE_SHORT },
        });
    }
}
