import { NextRequest, NextResponse } from "next/server";
import {
    fetchPrayerTimes,
    DHAKA_DEFAULTS,
    todayDateString,
} from "@/lib/prayer-times";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    const lat = parseFloat(
        searchParams.get("lat") ?? String(DHAKA_DEFAULTS.latitude)
    );
    const lng = parseFloat(
        searchParams.get("lng") ?? String(DHAKA_DEFAULTS.longitude)
    );
    const timezone = searchParams.get("tz") ?? DHAKA_DEFAULTS.timezone;
    const location = searchParams.get("location") ?? DHAKA_DEFAULTS.locationLabel;
    const date = searchParams.get("date") ?? todayDateString(timezone);

    // Basic validation
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
            { error: "Invalid latitude or longitude" },
            { status: 400 }
        );
    }

    try {
        const data = await fetchPrayerTimes(lat, lng, date, timezone, location);
        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("Prayer times fetch error:", error);
        return NextResponse.json(
            { error: "Failed to fetch prayer times" },
            { status: 502 }
        );
    }
}
