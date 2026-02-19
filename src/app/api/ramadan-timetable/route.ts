import { NextRequest, NextResponse } from "next/server";
import { fetchRamadanTimetable } from "@/lib/ramadan-timetable";
import { DHAKA_DEFAULTS, locationLabelFromTimezone } from "@/lib/prayer-times";

// Reasonable default coordinates for common timezones when lat/lng are omitted
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

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    const timezone = searchParams.get("tz") ?? DHAKA_DEFAULTS.timezone;

    // Prefer explicit coordinates, otherwise use timezone-based defaults where available
    const lat = parseFloat(
        searchParams.get("lat") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.latitude ?? DHAKA_DEFAULTS.latitude)
    );
    const lng = parseFloat(
        searchParams.get("lng") ?? String(TIMEZONE_DEFAULT_COORDS[timezone]?.longitude ?? DHAKA_DEFAULTS.longitude)
    );
    // Hijri year is auto-detected by the timetable service now
    const hijriYear = searchParams.get("year") ?? "";

    // Derive location label: prefer explicit `location`, then timezone-derived label, then Dhaka fallback
    const location =
        searchParams.get("location") ??
        (TIMEZONE_DEFAULT_COORDS[timezone]?.label ?? locationLabelFromTimezone(timezone) ?? DHAKA_DEFAULTS.locationLabel);

    if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
            { error: "Invalid coordinates" },
            { status: 400 },
        );
    }

    try {
        const timetable = await fetchRamadanTimetable(
            lat,
            lng,
            hijriYear,
            timezone,
            location,
        );
        return NextResponse.json(timetable, {
            headers: {
                "Cache-Control":
                    "public, s-maxage=86400, stale-while-revalidate=604800",
            },
        });
    } catch (error) {
        console.error("Ramadan timetable error:", error);
        return NextResponse.json(
            { error: "Failed to fetch Ramadan timetable" },
            { status: 502 },
        );
    }
}
