// Timezone -> sensible default coordinates/label when geolocation is not provided.
// Shared by /api/timings and /api/ramadan-timetable (the two Next handlers each had an identical copy).
export const TIMEZONE_DEFAULT_COORDS: Record<
  string,
  { latitude: number; longitude: number; label: string }
> = {
  "Asia/Bangkok": { latitude: 13.7563, longitude: 100.5018, label: "Bangkok, Thailand" },
  "Asia/Dhaka": { latitude: 23.8103, longitude: 90.4125, label: "ঢাকা, বাংলাদেশ" },
  "Asia/Kolkata": { latitude: 22.5726, longitude: 88.3639, label: "Kolkata, India" },
  "Asia/Karachi": { latitude: 24.8607, longitude: 67.0011, label: "Karachi, Pakistan" },
  "Asia/Riyadh": { latitude: 24.7136, longitude: 46.6753, label: "Riyadh, Saudi Arabia" },
  "Asia/Dubai": { latitude: 25.2048, longitude: 55.2708, label: "Dubai, UAE" },
  "Asia/Jakarta": { latitude: -6.2088, longitude: 106.8456, label: "Jakarta, Indonesia" },
  "Europe/London": { latitude: 51.5074, longitude: -0.1278, label: "London, UK" },
  "America/New_York": { latitude: 40.7128, longitude: -74.006, label: "New York, USA" },
};
