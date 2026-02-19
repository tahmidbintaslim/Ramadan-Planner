import { NextRequest, NextResponse } from "next/server";
import { getRamadanStatus } from "@/lib/ramadan-date";
import {
    getCountryCodeForCoordinates,
    getCountryCodeForTimezone,
} from "@/lib/hijri-offsets";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const timezone = searchParams.get("tz") ?? "Asia/Dhaka";
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const countryQuery = searchParams.get("cc") ?? undefined;
    const latitude = latParam ? Number.parseFloat(latParam) : null;
    const longitude = lngParam ? Number.parseFloat(lngParam) : null;
    const hasCoordinates =
        latitude !== null &&
        longitude !== null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude);
    const countryFromCoords = hasCoordinates
        ? getCountryCodeForCoordinates(latitude, longitude)
        : undefined;
    const inferredCountry =
        countryQuery ?? countryFromCoords ?? getCountryCodeForTimezone(timezone);

    try {
        const status = await getRamadanStatus(
            timezone,
            inferredCountry,
            hasCoordinates ? { latitude, longitude } : undefined,
        );
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
