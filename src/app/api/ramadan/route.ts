import { NextRequest, NextResponse } from "next/server";
import { getRamadanStatus } from "@/lib/ramadan-date";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const timezone = searchParams.get("tz") ?? "Asia/Dhaka";

    try {
        const status = await getRamadanStatus(timezone);
        return NextResponse.json(status, {
            headers: {
                "Cache-Control":
                    "public, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("Ramadan status error:", error);
        return NextResponse.json(
            { error: "Failed to fetch Ramadan status" },
            { status: 502 },
        );
    }
}
