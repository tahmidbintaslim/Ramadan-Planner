import { NextRequest, NextResponse } from "next/server";
import {
    fetchPrayerTimes,
    DHAKA_DEFAULTS,
    todayDateString,
    locationLabelFromTimezone,
} from "@/lib/prayer-times";

// Timezone -> sensible default coords/label when geolocation is not provided
const TIMEZONE_DEFAULT_COORDS: Record<string, { latitude: number; longitude: number; label: string }> = {
    "Asia/Bangkok": { latitude: 13.7563, longitude: 100.5018, label: "Bangkok, Thailand" },
    "Asia/Dhaka": { latitude: 23.8103, longitude: 90.4125, label: "ঢাকা, বাংলাদেশ" },
    "Asia/Kolkata": { latitude: 22.5726, longitude: 88.3639, label: "Kolkata, India" },
    "Asia/Karachi": { latitude: 24.8607, longitude: 67.0011, label: "Karachi, Pakistan" },
    "Asia/Riyadh": { latitude: 24.7136, longitude: 46.6753, label: "Riyadh, Saudi Arabia" },
    "Asia/Dubai": { latitude: 25.2048, longitude: 55.2708, label: "Dubai, UAE" },
    "Asia/Jakarta": { latitude: -6.2088, longitude: 106.8456, label: "Jakarta, Indonesia" },
    "Europe/London": { latitude: 51.5074, longitude: -0.1278, label: "London, UK" },
    "America/New_York": { latitude: 40.7128, longitude: -74.0060, label: "New York, USA" },
};

function normalizeAlAdhanDate(rawDate: string): string {
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${day}-${month}-${year}`;
    }

    const alAdhanMatch = /^\d{2}-\d{2}-\d{4}$/.test(rawDate);
    if (alAdhanMatch) {
        return rawDate;
    }

    return rawDate;
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    const timezone = searchParams.get("tz") ?? DHAKA_DEFAULTS.timezone;

    const lat = parseFloat(
        searchParams.get("lat") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.latitude ?? DHAKA_DEFAULTS.latitude)
    );
    const lng = parseFloat(
        searchParams.get("lng") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.longitude ?? DHAKA_DEFAULTS.longitude)
    );

    // Derive location label: use explicit param, or auto-detect from timezone
    const location =
        searchParams.get("location") ??
        (TIMEZONE_DEFAULT_COORDS[timezone]?.label ?? locationLabelFromTimezone(timezone) ?? DHAKA_DEFAULTS.locationLabel);

    const rawDate = searchParams.get("date");
    const date = rawDate ? normalizeAlAdhanDate(rawDate) : todayDateString(timezone);

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
