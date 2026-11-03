// The 64 districts of Bangladesh with the approximate coordinates of each district town (2 decimals, about
// 1 km: plenty for prayer times). Used by the first-run district picker and to name a coarse device position.
// Pure data and functions: no browser or server APIs.

export interface District {
  /** Stable id (English, lower-case, ASCII). Stored in localStorage: never rename one. */
  id: string;
  bn: string;
  en: string;
  lat: number;
  lng: number;
  /** Older or alternative spellings people type ("Chittagong", "Comilla", ...). */
  aliases?: string[];
}

export const DISTRICTS: readonly District[] = [
  // Dhaka division
  { id: "dhaka", bn: "ঢাকা", en: "Dhaka", lat: 23.81, lng: 90.41, aliases: ["dacca"] },
  { id: "faridpur", bn: "ফরিদপুর", en: "Faridpur", lat: 23.61, lng: 89.84 },
  { id: "gazipur", bn: "গাজীপুর", en: "Gazipur", lat: 24.0, lng: 90.42 },
  { id: "gopalganj", bn: "গোপালগঞ্জ", en: "Gopalganj", lat: 23.01, lng: 89.83 },
  { id: "kishoreganj", bn: "কিশোরগঞ্জ", en: "Kishoreganj", lat: 24.44, lng: 90.78 },
  { id: "madaripur", bn: "মাদারীপুর", en: "Madaripur", lat: 23.17, lng: 90.2 },
  { id: "manikganj", bn: "মানিকগঞ্জ", en: "Manikganj", lat: 23.86, lng: 90.0 },
  { id: "munshiganj", bn: "মুন্সিগঞ্জ", en: "Munshiganj", lat: 23.54, lng: 90.53 },
  { id: "narayanganj", bn: "নারায়ণগঞ্জ", en: "Narayanganj", lat: 23.62, lng: 90.5 },
  { id: "narsingdi", bn: "নরসিংদী", en: "Narsingdi", lat: 23.92, lng: 90.72 },
  { id: "rajbari", bn: "রাজবাড়ী", en: "Rajbari", lat: 23.76, lng: 89.64 },
  { id: "shariatpur", bn: "শরীয়তপুর", en: "Shariatpur", lat: 23.21, lng: 90.35 },
  { id: "tangail", bn: "টাঙ্গাইল", en: "Tangail", lat: 24.25, lng: 89.92 },
  // Chattogram division
  { id: "chattogram", bn: "চট্টগ্রাম", en: "Chattogram", lat: 22.36, lng: 91.78, aliases: ["chittagong", "ctg"] },
  { id: "coxsbazar", bn: "কক্সবাজার", en: "Cox's Bazar", lat: 21.43, lng: 92.01, aliases: ["coxs bazar", "cox bazar"] },
  { id: "cumilla", bn: "কুমিল্লা", en: "Cumilla", lat: 23.46, lng: 91.18, aliases: ["comilla"] },
  { id: "feni", bn: "ফেনী", en: "Feni", lat: 23.02, lng: 91.4 },
  { id: "brahmanbaria", bn: "ব্রাহ্মণবাড়িয়া", en: "Brahmanbaria", lat: 23.96, lng: 91.11 },
  { id: "chandpur", bn: "চাঁদপুর", en: "Chandpur", lat: 23.23, lng: 90.67 },
  { id: "lakshmipur", bn: "লক্ষ্মীপুর", en: "Lakshmipur", lat: 22.94, lng: 90.83, aliases: ["laxmipur"] },
  { id: "noakhali", bn: "নোয়াখালী", en: "Noakhali", lat: 22.87, lng: 91.1 },
  { id: "khagrachhari", bn: "খাগড়াছড়ি", en: "Khagrachhari", lat: 23.12, lng: 91.98, aliases: ["khagrachari"] },
  { id: "rangamati", bn: "রাঙ্গামাটি", en: "Rangamati", lat: 22.65, lng: 92.18, aliases: ["রাঙামাটি"] },
  { id: "bandarban", bn: "বান্দরবান", en: "Bandarban", lat: 22.2, lng: 92.22 },
  // Rajshahi division
  { id: "rajshahi", bn: "রাজশাহী", en: "Rajshahi", lat: 24.37, lng: 88.6 },
  { id: "bogura", bn: "বগুড়া", en: "Bogura", lat: 24.85, lng: 89.37, aliases: ["bogra"] },
  { id: "joypurhat", bn: "জয়পুরহাট", en: "Joypurhat", lat: 25.1, lng: 89.02 },
  { id: "naogaon", bn: "নওগাঁ", en: "Naogaon", lat: 24.81, lng: 88.94 },
  { id: "natore", bn: "নাটোর", en: "Natore", lat: 24.42, lng: 89.0 },
  { id: "chapainawabganj", bn: "চাঁপাইনবাবগঞ্জ", en: "Chapainawabganj", lat: 24.6, lng: 88.27, aliases: ["nawabganj", "chapai nawabganj"] },
  { id: "pabna", bn: "পাবনা", en: "Pabna", lat: 24.01, lng: 89.24 },
  { id: "sirajganj", bn: "সিরাজগঞ্জ", en: "Sirajganj", lat: 24.45, lng: 89.7 },
  // Khulna division
  { id: "khulna", bn: "খুলনা", en: "Khulna", lat: 22.82, lng: 89.55 },
  { id: "bagerhat", bn: "বাগেরহাট", en: "Bagerhat", lat: 22.65, lng: 89.79 },
  { id: "chuadanga", bn: "চুয়াডাঙ্গা", en: "Chuadanga", lat: 23.64, lng: 88.84 },
  { id: "jashore", bn: "যশোর", en: "Jashore", lat: 23.17, lng: 89.21, aliases: ["jessore"] },
  { id: "jhenaidah", bn: "ঝিনাইদহ", en: "Jhenaidah", lat: 23.54, lng: 89.17 },
  { id: "kushtia", bn: "কুষ্টিয়া", en: "Kushtia", lat: 23.9, lng: 89.12 },
  { id: "magura", bn: "মাগুরা", en: "Magura", lat: 23.49, lng: 89.42 },
  { id: "meherpur", bn: "মেহেরপুর", en: "Meherpur", lat: 23.76, lng: 88.63 },
  { id: "narail", bn: "নড়াইল", en: "Narail", lat: 23.17, lng: 89.51 },
  { id: "satkhira", bn: "সাতক্ষীরা", en: "Satkhira", lat: 22.72, lng: 89.07 },
  // Barishal division
  { id: "barishal", bn: "বরিশাল", en: "Barishal", lat: 22.7, lng: 90.37, aliases: ["barisal"] },
  { id: "barguna", bn: "বরগুনা", en: "Barguna", lat: 22.15, lng: 90.12 },
  { id: "bhola", bn: "ভোলা", en: "Bhola", lat: 22.69, lng: 90.65 },
  { id: "jhalokathi", bn: "ঝালকাঠি", en: "Jhalokathi", lat: 22.64, lng: 90.2, aliases: ["jhalakati", "jhalokati"] },
  { id: "patuakhali", bn: "পটুয়াখালী", en: "Patuakhali", lat: 22.36, lng: 90.33 },
  { id: "pirojpur", bn: "পিরোজপুর", en: "Pirojpur", lat: 22.58, lng: 89.98 },
  // Sylhet division
  { id: "sylhet", bn: "সিলেট", en: "Sylhet", lat: 24.9, lng: 91.87 },
  { id: "habiganj", bn: "হবিগঞ্জ", en: "Habiganj", lat: 24.38, lng: 91.42 },
  { id: "moulvibazar", bn: "মৌলভীবাজার", en: "Moulvibazar", lat: 24.48, lng: 91.78, aliases: ["maulvibazar"] },
  { id: "sunamganj", bn: "সুনামগঞ্জ", en: "Sunamganj", lat: 25.07, lng: 91.4 },
  // Rangpur division
  { id: "rangpur", bn: "রংপুর", en: "Rangpur", lat: 25.74, lng: 89.25 },
  { id: "dinajpur", bn: "দিনাজপুর", en: "Dinajpur", lat: 25.63, lng: 88.64 },
  { id: "gaibandha", bn: "গাইবান্ধা", en: "Gaibandha", lat: 25.33, lng: 89.54 },
  { id: "kurigram", bn: "কুড়িগ্রাম", en: "Kurigram", lat: 25.81, lng: 89.64 },
  { id: "lalmonirhat", bn: "লালমনিরহাট", en: "Lalmonirhat", lat: 25.92, lng: 89.45 },
  { id: "nilphamari", bn: "নীলফামারী", en: "Nilphamari", lat: 25.93, lng: 88.86 },
  { id: "panchagarh", bn: "পঞ্চগড়", en: "Panchagarh", lat: 26.33, lng: 88.55 },
  { id: "thakurgaon", bn: "ঠাকুরগাঁও", en: "Thakurgaon", lat: 26.03, lng: 88.46 },
  // Mymensingh division
  { id: "mymensingh", bn: "ময়মনসিংহ", en: "Mymensingh", lat: 24.75, lng: 90.41 },
  { id: "jamalpur", bn: "জামালপুর", en: "Jamalpur", lat: 24.92, lng: 89.95 },
  { id: "netrokona", bn: "নেত্রকোণা", en: "Netrokona", lat: 24.88, lng: 90.73, aliases: ["netrakona", "নেত্রকোনা"] },
  { id: "sherpur", bn: "শেরপুর", en: "Sherpur", lat: 25.02, lng: 90.02 },
];

/** The divisional towns, offered as one-tap chips. */
export const POPULAR_DISTRICT_IDS = [
  "dhaka",
  "chattogram",
  "sylhet",
  "rajshahi",
  "khulna",
  "barishal",
  "rangpur",
  "mymensingh",
] as const;

export const DEFAULT_DISTRICT_ID = "dhaka";

const BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));

export function districtById(id: string | null | undefined): District | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function districtName(d: District, locale: string): string {
  return locale.startsWith("bn") ? d.bn : d.en;
}

/** Lower-case, NFC, no punctuation or spaces, "district"/"জেলা" suffix dropped. */
export function normalizeDistrictQuery(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s*(district|zila|zilla|জেলা)\s*$/u, "")
    .replace(/[\s'’.,\-_()]/g, "");
}

function namesOf(d: District): string[] {
  return [d.bn, d.en, ...(d.aliases ?? [])].map(normalizeDistrictQuery);
}

/**
 * Districts matching a typed query, best first: exact name, then prefix, then substring (Bengali or English,
 * any alias). An empty query matches nothing.
 */
export function matchDistricts(query: string, limit = 6): District[] {
  const q = normalizeDistrictQuery(query);
  if (!q) return [];
  const scored: { d: District; score: number; index: number }[] = [];
  DISTRICTS.forEach((d, index) => {
    const names = namesOf(d);
    let score = 0;
    if (names.some((n) => n === q)) score = 3;
    else if (names.some((n) => n.startsWith(q))) score = 2;
    else if (names.some((n) => n.includes(q))) score = 1;
    if (score) scored.push({ d, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map((s) => s.d);
}

/** The district a full typed name refers to: an exact match, or the only remaining candidate. */
export function findDistrict(query: string): District | undefined {
  const matches = matchDistricts(query, 64);
  if (matches.length === 0) return undefined;
  const q = normalizeDistrictQuery(query);
  return matches.find((d) => namesOf(d).includes(q)) ?? (matches.length === 1 ? matches[0] : undefined);
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest district town within `maxKm` (default 60 km), or undefined outside Bangladesh. */
export function nearestDistrict(lat: number, lng: number, maxKm = 60): District | undefined {
  let best: District | undefined;
  let bestKm = Infinity;
  for (const d of DISTRICTS) {
    const km = distanceKm(lat, lng, d.lat, d.lng);
    if (km < bestKm) {
      best = d;
      bestKm = km;
    }
  }
  return bestKm <= maxKm ? best : undefined;
}
