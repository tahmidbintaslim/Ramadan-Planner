import { NextRequest, NextResponse } from "next/server";
import { fetchSurahList, fetchSurah } from "@/lib/quran";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const surahNumber = searchParams.get("surah");

    try {
        if (surahNumber) {
            const num = parseInt(surahNumber, 10);
            if (isNaN(num) || num < 1 || num > 114) {
                return NextResponse.json(
                    { error: "Surah number must be between 1 and 114" },
                    { status: 400 },
                );
            }

            const edition = searchParams.get("edition") ?? "quran-uthmani";
            const data = await fetchSurah(num, edition);
            return NextResponse.json(data, {
                headers: {
                    "Cache-Control":
                        "public, s-maxage=604800, stale-while-revalidate=2592000",
                },
            });
        }

        // No surah specified → return full list
        const data = await fetchSurahList();
        return NextResponse.json(data, {
            headers: {
                "Cache-Control":
                    "public, s-maxage=604800, stale-while-revalidate=2592000",
            },
        });
    } catch (error) {
        console.error("Quran API fetch error:", error);
        return NextResponse.json(
            { error: "Failed to fetch Quran data" },
            { status: 502 },
        );
    }
}
