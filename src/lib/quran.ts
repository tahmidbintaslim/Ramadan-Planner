// Quran data service – reads from local Postgres (seeded from quranapi.pages.dev)
// Falls back to external API when DB is empty (pre-seed).

import { prisma } from "@/lib/prisma";

// ── Public types ─────────────────────────────────────────

export interface AudioEntry {
    reciter: string;
    url: string;
    originalUrl: string;
}

export interface SurahInfo {
    surahNo: number;
    nameArabic: string;
    nameArabicLong: string;
    nameEnglish: string;
    nameTranslation: string;
    nameBengali: string;
    revelationPlace: string;
    totalAyah: number;
}

export interface QuranAyah {
    ayahNo: number;
    textArabic: string;
    textArabicClean: string;
    textEnglish: string;
    textBengali: string;
    audio: Record<string, AudioEntry>;
}

export interface SurahDetail extends SurahInfo {
    audio: Record<string, AudioEntry>;
    ayahs: QuranAyah[];
}

export interface ReciterInfo {
    id: number;
    name: string;
}

// ── External API base (used only by seed script & fallback) ─

export const QURAN_API_BASE = "https://quranapi.pages.dev/api";

// ── In-memory cache (server-side, per-instance) ──────────

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

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
    if (cache.size > 300) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── DB query helpers ─────────────────────────────────────

/**
 * Fetch list of all 114 surahs (metadata only, no ayahs).
 */
export async function fetchSurahList(): Promise<SurahInfo[]> {
    const cacheKey = "surah-list";
    const cached = getFromCache<SurahInfo[]>(cacheKey);
    if (cached) return cached;

    const rows = await prisma.quranSurah.findMany({
        orderBy: { surahNo: "asc" },
        select: {
            surahNo: true,
            nameArabic: true,
            nameArabicLong: true,
            nameEnglish: true,
            nameTranslation: true,
            nameBengali: true,
            revelationPlace: true,
            totalAyah: true,
        },
    });

    if (rows.length === 0) {
        // DB not seeded yet – fall back to external API
        return fetchSurahListExternal();
    }

    const data: SurahInfo[] = rows;
    setCache(cacheKey, data);
    return data;
}

/**
 * Fetch a full surah with ayahs (Arabic + English + Bengali + audio).
 */
export async function fetchSurah(surahNumber: number): Promise<SurahDetail | null> {
    const cacheKey = `surah-${surahNumber}`;
    const cached = getFromCache<SurahDetail>(cacheKey);
    if (cached) return cached;

    const row = await prisma.quranSurah.findUnique({
        where: { surahNo: surahNumber },
        include: {
            ayahs: {
                orderBy: { ayahNo: "asc" },
            },
        },
    });

    if (!row) return null;

    const detail: SurahDetail = {
        surahNo: row.surahNo,
        nameArabic: row.nameArabic,
        nameArabicLong: row.nameArabicLong,
        nameEnglish: row.nameEnglish,
        nameTranslation: row.nameTranslation,
        nameBengali: row.nameBengali,
        revelationPlace: row.revelationPlace,
        totalAyah: row.totalAyah,
        audio: row.audio as unknown as Record<string, AudioEntry>,
        ayahs: row.ayahs.map((a) => ({
            ayahNo: a.ayahNo,
            textArabic: a.textArabic,
            textArabicClean: a.textArabicClean,
            textEnglish: a.textEnglish,
            textBengali: a.textBengali,
            audio: a.audio as unknown as Record<string, AudioEntry>,
        })),
    };

    setCache(cacheKey, detail);
    return detail;
}

/**
 * Fetch available reciters.
 */
export async function fetchReciters(): Promise<ReciterInfo[]> {
    const cacheKey = "reciters";
    const cached = getFromCache<ReciterInfo[]>(cacheKey);
    if (cached) return cached;

    const rows = await prisma.quranReciter.findMany({
        orderBy: { id: "asc" },
    });

    const data: ReciterInfo[] = rows.map((r) => ({ id: r.id, name: r.name }));
    setCache(cacheKey, data);
    return data;
}

/**
 * Fetch a random ayah for "Verse of the Day" style display.
 */
export async function fetchRandomAyah(): Promise<{
    surahNo: number;
    surahName: string;
    ayahNo: number;
    textArabic: string;
    textBengali: string;
    textEnglish: string;
} | null> {
    const count = await prisma.quranAyah.count();
    if (count === 0) return null;

    const skip = Math.floor(Math.random() * count);
    const ayah = await prisma.quranAyah.findFirst({
        skip,
        include: { surah: { select: { nameArabic: true } } },
    });

    if (!ayah) return null;

    return {
        surahNo: ayah.surahNo,
        surahName: ayah.surah.nameArabic,
        ayahNo: ayah.ayahNo,
        textArabic: ayah.textArabic,
        textBengali: ayah.textBengali,
        textEnglish: ayah.textEnglish,
    };
}

// ── External API fallback (pre-seed only) ────────────────

interface ExtSurah {
    surahName: string;
    surahNameArabic: string;
    surahNameArabicLong: string;
    surahNameTranslation: string;
    revelationPlace: string;
    totalAyah: number;
}

async function fetchSurahListExternal(): Promise<SurahInfo[]> {
    try {
        const res = await fetch(`${QURAN_API_BASE}/surah.json`, {
            next: { revalidate: 604800 },
        });
        if (!res.ok) return [];
        const data: ExtSurah[] = await res.json();
        return data.map((s, i) => ({
            surahNo: i + 1,
            nameArabic: s.surahNameArabic,
            nameArabicLong: s.surahNameArabicLong,
            nameEnglish: s.surahName,
            nameTranslation: s.surahNameTranslation,
            nameBengali: SURAH_NAMES_BN[i + 1] ?? s.surahName,
            revelationPlace: s.revelationPlace,
            totalAyah: s.totalAyah,
        }));
    } catch {
        return [];
    }
}

// ── Bengali surah names (all 114) ────────────────────────

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
    21: "আল-আম্বিয়া",
    22: "আল-হাজ্জ",
    23: "আল-মু'মিনূন",
    24: "আন-নূর",
    25: "আল-ফুরকান",
    26: "আশ-শুআরা",
    27: "আন-নামল",
    28: "আল-কাসাস",
    29: "আল-আনকাবূত",
    30: "আর-রূম",
    31: "লুকমান",
    32: "আস-সাজদা",
    33: "আল-আহযাব",
    34: "সাবা",
    35: "ফাতির",
    36: "ইয়াসীন",
    37: "আস-সাফফাত",
    38: "সোয়াদ",
    39: "আয-যুমার",
    40: "গাফির",
    41: "ফুসসিলাত",
    42: "আশ-শূরা",
    43: "আয-যুখরুফ",
    44: "আদ-দুখান",
    45: "আল-জাসিয়া",
    46: "আল-আহকাফ",
    47: "মুহাম্মাদ",
    48: "আল-ফাতহ",
    49: "আল-হুজুরাত",
    50: "ক্বাফ",
    51: "আয-যারিয়াত",
    52: "আত-তূর",
    53: "আন-নাজম",
    54: "আল-কামার",
    55: "আর-রাহমান",
    56: "আল-ওয়াকিয়া",
    57: "আল-হাদীদ",
    58: "আল-মুজাদালা",
    59: "আল-হাশর",
    60: "আল-মুমতাহিনা",
    61: "আস-সফ",
    62: "আল-জুমু'আ",
    63: "আল-মুনাফিকূন",
    64: "আত-তাগাবুন",
    65: "আত-তালাক",
    66: "আত-তাহরীম",
    67: "আল-মুলক",
    68: "আল-কলম",
    69: "আল-হাক্কা",
    70: "আল-মাআরিজ",
    71: "নূহ",
    72: "আল-জিন",
    73: "আল-মুযযাম্মিল",
    74: "আল-মুদ্দাসসির",
    75: "আল-কিয়ামা",
    76: "আল-ইনসান",
    77: "আল-মুরসালাত",
    78: "আন-নাবা",
    79: "আন-নাযিআত",
    80: "আবাসা",
    81: "আত-তাকবীর",
    82: "আল-ইনফিতার",
    83: "আল-মুতাফফিফীন",
    84: "আল-ইনশিকাক",
    85: "আল-বুরূজ",
    86: "আত-তারিক",
    87: "আল-আ'লা",
    88: "আল-গাশিয়া",
    89: "আল-ফাজর",
    90: "আল-বালাদ",
    91: "আশ-শামস",
    92: "আল-লাইল",
    93: "আদ-দুহা",
    94: "আল-ইনশিরাহ",
    95: "আত-তীন",
    96: "আল-আলাক",
    97: "আল-কদর",
    98: "আল-বায়্যিনা",
    99: "আয-যিলযাল",
    100: "আল-আদিয়াত",
    101: "আল-কারিআ",
    102: "আত-তাকাসুর",
    103: "আল-আসর",
    104: "আল-হুমাযা",
    105: "আল-ফীল",
    106: "কুরাইশ",
    107: "আল-মাঊন",
    108: "আল-কাউসার",
    109: "আল-কাফিরূন",
    110: "আন-নাসর",
    111: "আল-লাহাব",
    112: "আল-ইখলাস",
    113: "আল-ফালাক",
    114: "আন-নাস",
};
