/**
 * Seed Quran data using node-postgres (`pg`) against DATABASE_URL/DIRECT_URL.
 * Usage: npx tsx scripts/seed-quran.ts
 */

import path from "node:path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DB_URL) {
    console.error("No DATABASE_URL or DIRECT_URL found in environment");
    process.exit(1);
}

const API = "https://quranapi.pages.dev/api";

const SURAH_NAMES_BN: Record<number, string> = {
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
    97: "আল-кদর",
    98: "আল-বায়্যিনা",
    99: "আয-যিলযাল",
    100: "আল-আদিয়াত",
    101: "আল-কারিআ",
    102: "আত-তাকাসур",
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

interface SurahMeta {
    surahName: string;
    surahNameArabic: string;
    surahNameArabicLong: string;
    surahNameTranslation: string;
    revelationPlace: string;
    totalAyah: number;
}

interface AudioEntry {
    reciter: string;
    url: string;
    originalUrl: string;
}

interface VerseAudioEntry {
    reciter: string;
    audios?: Array<AudioEntry | null>;
}

interface TranslationSurah {
    surahNo: number;
    translation?: string[];
    audio?: Record<string, AudioEntry>;
    verseAudio?: Record<string, VerseAudioEntry>;
}

async function fetchJson<T>(url: string): Promise<T> {
    console.log(`  ⬇  ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.json() as Promise<T>;
}

async function fetchWithFallback(base: string): Promise<TranslationSurah[]> {
    try {
        return await fetchJson(`${base}.min.json`);
    } catch (err) {
        console.warn(`    (min.json failed) ${String(err)} — trying full json`);
    }
    return await fetchJson(`${base}.json`);
}

async function main() {
    console.log("🕌 Seeding Quran data via pg …\n");
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    // 1. Reciters
    console.log("1/5  Fetching reciters …");
    const recitersMap = await fetchJson<Record<string, string>>(`${API}/reciters.json`);
    for (const [idStr, name] of Object.entries(recitersMap)) {
        const id = Number(idStr);
        await client.query(
            `INSERT INTO quran_reciters(reciter_id, name) VALUES ($1,$2)
             ON CONFLICT (reciter_id) DO UPDATE SET name = EXCLUDED.name`,
            [id, name],
        );
    }
    console.log(`   ✅ ${Object.keys(recitersMap).length} reciters saved.\n`);

    // 2. Surah metadata
    console.log("2/5  Fetching surah list …");
    const surahList = await fetchJson<SurahMeta[]>(`${API}/surah.json`);
    console.log(`   ✅ ${surahList.length} surahs fetched.\n`);

    // 3. Translation dumps
    console.log("3/5  Fetching Arabic (with tashkeel) …");
    const arabic1 = await fetchWithFallback(`${API}/arabic1`);
    console.log("     Fetching Arabic (without tashkeel) …");
    const arabic2 = await fetchWithFallback(`${API}/arabic2`);
    console.log("     Fetching English …");
    const english = await fetchWithFallback(`${API}/english`);
    console.log("     Fetching Bengali …");
    const bengali = await fetchWithFallback(`${API}/bengali`);
    console.log("   ✅ All translation dumps fetched.\n");

    const ar1Map = new Map(arabic1.map((s) => [s.surahNo, s]));
    const ar2Map = new Map(arabic2.map((s) => [s.surahNo, s]));
    const enMap = new Map(english.map((s) => [s.surahNo, s]));
    const bnMap = new Map(bengali.map((s) => [s.surahNo, s]));

    console.log("4/5  Upserting surahs & ayahs into DB …");
    let totalAyahs = 0;

    for (let i = 0; i < surahList.length; i++) {
        const meta = surahList[i];
        const surahNo = i + 1;
        const enSurah = enMap.get(surahNo);
        const ar1Surah = ar1Map.get(surahNo);
        const ar2Surah = ar2Map.get(surahNo);
        const bnSurah = bnMap.get(surahNo);

        const chapterAudio: Record<string, AudioEntry> = {};
        if (enSurah?.audio) {
            for (const [rid, entry] of Object.entries(enSurah.audio)) {
                chapterAudio[rid] = { reciter: entry.reciter, url: entry.url, originalUrl: entry.originalUrl };
            }
        }

        await client.query(
            `INSERT INTO quran_surahs(surah_no, name_arabic, name_arabic_long, name_english, name_translation, name_bengali, revelation_place, total_ayah, audio)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (surah_no) DO UPDATE
             SET name_arabic=EXCLUDED.name_arabic, name_arabic_long=EXCLUDED.name_arabic_long, name_english=EXCLUDED.name_english, name_translation=EXCLUDED.name_translation, name_bengali=EXCLUDED.name_bengali, revelation_place=EXCLUDED.revelation_place, total_ayah=EXCLUDED.total_ayah, audio=EXCLUDED.audio`,
            [
                surahNo,
                meta.surahNameArabic,
                meta.surahNameArabicLong,
                meta.surahName,
                meta.surahNameTranslation,
                SURAH_NAMES_BN[surahNo] ?? meta.surahName,
                meta.revelationPlace,
                meta.totalAyah,
                chapterAudio,
            ],
        );

        const ayahCount = meta.totalAyah;
        for (let a = 0; a < ayahCount; a++) {
            const ayahNo = a + 1;
            const textArabic = ar1Surah?.translation?.[a] ?? "";
            const textArabicClean = ar2Surah?.translation?.[a] ?? "";
            const textEnglish = enSurah?.translation?.[a] ?? "";
            const textBengali = bnSurah?.translation?.[a] ?? "";

            const ayahAudio: Record<string, AudioEntry> = {};
            if (enSurah?.verseAudio) {
                for (const [rid, recEntry] of Object.entries(enSurah.verseAudio)) {
                    const audioData = recEntry.audios?.[a];
                    if (audioData) {
                        ayahAudio[rid] = { reciter: recEntry.reciter, url: audioData.url, originalUrl: audioData.originalUrl };
                    }
                }
            }

            await client.query(
                `INSERT INTO quran_ayahs(surah_no, ayah_no, text_arabic, text_arabic_clean, text_english, text_bengali, audio)
                 VALUES($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (surah_no, ayah_no) DO UPDATE
                 SET text_arabic=EXCLUDED.text_arabic, text_arabic_clean=EXCLUDED.text_arabic_clean, text_english=EXCLUDED.text_english, text_bengali=EXCLUDED.text_bengali, audio=EXCLUDED.audio` ,
                [surahNo, ayahNo, textArabic, textArabicClean, textEnglish, textBengali, ayahAudio],
            );

            totalAyahs++;
        }

        if (surahNo % 10 === 0 || surahNo === surahList.length) {
            console.log(`   📖 ${surahNo}/${surahList.length} surahs done  (${totalAyahs} ayahs)`);
        }
    }

    console.log(`   ✅ ${surahList.length} surahs, ${totalAyahs} ayahs saved.\n`);

    console.log("5/5  Verifying …");
    const surahCountRes = await client.query("SELECT COUNT(*)::int AS c FROM quran_surahs");
    const ayahCountRes = await client.query("SELECT COUNT(*)::int AS c FROM quran_ayahs");
    const reciterCountRes = await client.query("SELECT COUNT(*)::int AS c FROM quran_reciters");
    console.log(`   📊 DB has: ${surahCountRes.rows[0].c} surahs, ${ayahCountRes.rows[0].c} ayahs, ${reciterCountRes.rows[0].c} reciters`);

    await client.end();
    console.log("\n🎉 Quran seed complete!");
}

main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
