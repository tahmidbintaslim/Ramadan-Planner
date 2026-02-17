// Al-Quran Cloud API service
// Docs: https://alquran.cloud/api
// Provides Surah list, Arabic text, translations

const QURAN_API_BASE = "https://api.alquran.cloud/v1";

export interface SurahInfo {
    number: number;
    name: string; // Arabic
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: "Meccan" | "Medinan";
}

export interface QuranAyah {
    number: number;
    text: string;
    numberInSurah: number;
    juz: number;
    page: number;
}

export interface SurahDetail {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
    ayahs: QuranAyah[];
}

interface AlQuranListResponse {
    code: number;
    status: string;
    data: SurahInfo[];
}

interface AlQuranSurahResponse {
    code: number;
    status: string;
    data: SurahDetail;
}

// ── Cache ──────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Quran doesn't change)

function getFromCache<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data as T;
}

function setCache(key: string, data: unknown): void {
    if (cache.size > 200) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Fetch list of all 114 Surahs
 */
export async function fetchSurahList(): Promise<SurahInfo[]> {
    const cacheKey = "surah-list";
    const cached = getFromCache<SurahInfo[]>(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${QURAN_API_BASE}/surah`, {
        next: { revalidate: 604800 }, // 7 days ISR
    });

    if (!res.ok) {
        throw new Error(`Quran API error: ${res.status}`);
    }

    const json: AlQuranListResponse = await res.json();
    if (json.code !== 200) {
        throw new Error(`Quran API returned code ${json.code}`);
    }

    setCache(cacheKey, json.data);
    return json.data;
}

/**
 * Fetch a specific Surah in Arabic (uthmani text)
 */
export async function fetchSurah(
    surahNumber: number,
    edition: string = "quran-uthmani",
): Promise<SurahDetail> {
    const cacheKey = `surah-${surahNumber}-${edition}`;
    const cached = getFromCache<SurahDetail>(cacheKey);
    if (cached) return cached;

    const res = await fetch(
        `${QURAN_API_BASE}/surah/${surahNumber}/${edition}`,
        {
            next: { revalidate: 604800 },
        },
    );

    if (!res.ok) {
        throw new Error(`Quran API error: ${res.status}`);
    }

    const json: AlQuranSurahResponse = await res.json();
    if (json.code !== 200) {
        throw new Error(`Quran API returned code ${json.code}`);
    }

    setCache(cacheKey, json.data);
    return json.data;
}

/**
 * Fetch a random Ayah for "Verse of the Day" style display
 */
export async function fetchRandomAyah(
    edition: string = "quran-uthmani",
): Promise<{ surah: string; ayahNumber: number; text: string }> {
    const surahNum = Math.floor(Math.random() * 114) + 1;
    const surah = await fetchSurah(surahNum, edition);
    const ayahIdx = Math.floor(Math.random() * surah.ayahs.length);
    const ayah = surah.ayahs[ayahIdx];

    return {
        surah: surah.name,
        ayahNumber: ayah.numberInSurah,
        text: ayah.text,
    };
}

// Bengali surah names mapping (first 10 commonly known)
export const SURAH_NAMES_BN: Record<number, string> = {
    1: "আল-ফাতিহা",
    2: "আল-বাকারা",
    3: "আলে ইমরান",
    4: "আন-নিসা",
    5: "আল-মায়িদা",
    6: "আল-আনআম",
    7: "আল-আরাফ",
    8: "আল-আনফাল",
    9: "আত-তাওবা",
    10: "ইউনুস",
    11: "হুদ",
    12: "ইউসুফ",
    13: "আর-রাদ",
    14: "ইবরাহীম",
    15: "আল-হিজর",
    16: "আন-নাহল",
    17: "আল-ইসরা",
    18: "আল-কাহফ",
    19: "মারইয়াম",
    20: "ত্বা-হা",
    36: "ইয়াসীন",
    55: "আর-রাহমান",
    56: "আল-ওয়াকিয়া",
    67: "আল-মুলক",
    78: "আন-নাবা",
    112: "আল-ইখলাস",
    113: "আল-ফালাক",
    114: "আন-নাস",
};
