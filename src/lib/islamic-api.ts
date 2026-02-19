const BASE = "https://api.islamicapi.com";

function apiKey(): string | undefined {
    return process.env.ISLAMICAPI_KEY;
}

export async function fetchIslamicApiPrayerTimes(lat: number, lng: number, date: string, tz: string) {
    const key = apiKey();
    if (!key) throw new Error("Missing ISLAMICAPI_KEY");

    const url = `${BASE}/v1/prayer-time?latitude=${lat}&longitude=${lng}&date=${encodeURIComponent(date)}&time_zone=${encodeURIComponent(tz)}`;
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
            "x-api-key": key,
        },
    });
    if (!res.ok) throw new Error(`IslamicAPI prayer-time error: ${res.status}`);
    return res.json();
}

export async function fetchIslamicApiFastingInfo(lat: number, lng: number, date: string, tz: string) {
    const key = apiKey();
    if (!key) throw new Error("Missing ISLAMICAPI_KEY");

    const url = `${BASE}/v1/fasting?latitude=${lat}&longitude=${lng}&date=${encodeURIComponent(date)}&time_zone=${encodeURIComponent(tz)}`;
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
            "x-api-key": key,
        },
    });
    if (!res.ok) throw new Error(`IslamicAPI fasting error: ${res.status}`);
    return res.json();
}

const islamicApiClient = {
    fetchIslamicApiPrayerTimes,
    fetchIslamicApiFastingInfo,
};

export default islamicApiClient;
