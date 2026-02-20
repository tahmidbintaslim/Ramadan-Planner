/**
 * Seed Hadith data using node-postgres (`pg`) against the provided DATABASE_URL/DIRECT_URL.
 * Usage: npx tsx scripts/seed-hadith.ts
 */

import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

function requireEnv(candidates: string[], errorMessage: string): string {
    for (const key of candidates) {
        const value = process.env[key];
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
    }
    console.error(errorMessage);
    process.exit(1);
}

const DB_URL = requireEnv(
    ["DIRECT_URL", "DATABASE_URL"],
    "No DATABASE_URL or DIRECT_URL found in environment",
);

const API_BASE = "https://hadithapi.com/api";

// Read either correctly spelled env or the existing typo in .env.local
const HADITH_API_KEY = requireEnv(
    ["HADITHAPI_KEY", "HADIHAD_API_KEY"],
    "Missing HADITH API key. Set HADITHAPI_KEY or HADIHAD_API_KEY in your .env.local",
);

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
    return typeof value === "object" && value !== null;
}

function arrayFromPayload(payload: unknown, keys: string[] = ["books", "data", "hadiths", "hadith", "chapters"]): AnyRecord[] {
    if (Array.isArray(payload)) {
        return payload.filter(isRecord);
    }
    if (!isRecord(payload)) return [];
    for (const key of keys) {
        const value = payload[key];
        if (Array.isArray(value)) {
            return value.filter(isRecord);
        }
    }
    return [];
}

function asOptionalString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function fetchJson(url: string) {
    console.log("  ⬇  ", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.json();
}

async function fetchWithFallback(base: string, rawPath?: string) {
    // Try CDN min, CDN full, then optional raw GitHub path
    try {
        return await fetchJson(`${base}.min.json`);
    } catch (err) {
        console.warn(`    (min.json failed) ${String(err)} — trying full json`);
    }
    try {
        return await fetchJson(`${base}.json`);
    } catch (err) {
        console.warn(`    (cdn full failed) ${String(err)}${rawPath ? ' — trying raw fallback' : ''}`);
    }
    if (rawPath) {
        return await fetchJson(rawPath);
    }
    throw new Error('All fetch attempts failed');
}

function normalizeJsonField(raw: unknown): unknown {
    if (raw == null) return null;
    // Always return a JSON *string* (text) that represents the value. This
    // keeps parameter passing consistent and lets the SQL side cast the text
    // into jsonb reliably.
    if (typeof raw === 'object') {
        try {
            return JSON.stringify(raw);
        } catch {
            return JSON.stringify(String(raw));
        }
    }

    if (typeof raw === 'string') {
        const s = raw.trim();
        // If it already looks like JSON, return it as-is so it becomes valid JSON text.
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            return s;
        }
        // Otherwise return a JSON string literal
        return JSON.stringify(s);
    }

    // numbers/booleans -> JSON literal
    return JSON.stringify(raw);
}

function errorToLog(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function sanitizeBookLabel(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const lowered = trimmed.toLowerCase();
    if (
        lowered === "true" ||
        lowered === "false" ||
        lowered === "true true" ||
        lowered === "false false" ||
        lowered === "null" ||
        lowered === "undefined"
    ) {
        return null;
    }

    return trimmed;
}

async function main() {
    console.log("📚 Seeding Hadith via pg …\n");
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    // Clear existing hadith rows as requested (keep editions table intact)
    try {
        console.log("Clearing existing hadith rows (TRUNCATE hadith) …");
        await client.query("BEGIN");
        await client.query("TRUNCATE TABLE hadith RESTART IDENTITY CASCADE");
        await client.query("COMMIT");
        console.log("  ✅ hadith table truncated.\n");
    } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error("Failed to truncate hadith table:", e);
        await client.end();
        process.exit(1);
    }

    console.log("1/3  Fetching books from hadithapi.com …");
    const books = await fetchJson(`${API_BASE}/books?apiKey=${encodeURIComponent(HADITH_API_KEY)}`);
    // hadithapi returns { status, message, books: [...] }
    const booksArr = arrayFromPayload(books, ["books", "data"]);
    if (booksArr.length > 0) {
        // no-op
    }
    else {
        console.warn('Unexpected books response shape from hadithapi:', JSON.stringify(books).slice(0, 1000));
    }
    console.log(`   ✅ ${booksArr.length} books discovered.\n`);

    let totalHadiths = 0;
    let editionsSaved = 0;
    const processedEditions = new Set<string>();

    // Reusable helper to process and insert hadith list for any edition
    async function processHadithList(
        hadithList: ReadonlyArray<AnyRecord>,
        editionNameParam: string,
        chapterField: number | null,
    ) {
        if (!hadithList || !Array.isArray(hadithList) || hadithList.length === 0) return;

        // Normalize entries and filter out items without a numeric hadith number
        const normalized = hadithList.map((h) => {
            // Primary sources of hadith number
            const hadithNoRaw = h.hadithNumber ?? h.hadith_no ?? h.number ?? h.id ?? null;
            let hadithNo = hadithNoRaw != null && !Number.isNaN(Number(hadithNoRaw)) ? Number(hadithNoRaw) : null;

            // If missing, try to extract from nested reference objects like { book: 1, hadith: 1 }
            if (hadithNo == null) {
                const ref = h.references ?? h.reference ?? h.ref ?? h.meta ?? null;
                if (isRecord(ref)) {
                    // common keys
                    const cand = ref.hadith ?? ref.hadith_no ?? ref.hadithNumber ?? ref.number ?? null;
                    if (cand != null && !Number.isNaN(Number(cand))) hadithNo = Number(cand);
                } else if (typeof ref === 'string') {
                    const m = ref.match(/(hadith|hadith_no|hadithNumber|number)?\s*[:#\-]?\s*(\d{1,6})/i);
                    if (m && m[2]) hadithNo = Number(m[2]);
                }
            }

            // If still missing, try to parse from any string fields like text or translation (last resort)
            if (hadithNo == null) {
                const candidates = [
                    h.text,
                    h.translation,
                    h.hadith,
                    h.hadithEnglish,
                    h.hadith_arabic,
                    JSON.stringify(h),
                ]
                    .filter(Boolean)
                    .map(String);
                for (const s of candidates) {
                    const m = s.match(/(?:hadith|hadith_no|hadithNumber|hadith no|hadith no\.?|#)\s*[:#-]?\s*(\d{1,6})/i);
                    if (m && m[1]) { hadithNo = Number(m[1]); break; }
                    const m2 = s.match(/\b(\d{1,6})\b/);
                    if (m2 && m2[1]) { hadithNo = Number(m2[1]); break; }
                }
            }

            return {
                hadithNo,
                text: h.hadithEnglish ?? h.hadith_english ?? h.text ?? h.translation ?? h.hadith ?? "",
                textArabic: h.hadithArabic ?? h.hadith_arabic ?? h.textArabic ?? h.arabic ?? null,
                bookField:
                    sanitizeBookLabel(h.book) ??
                    titleFromEdition(editionNameParam) ??
                    editionNameParam,
                chapterVal: chapterField != null ? Number(chapterField) : (h.chapter ?? h.chapter_no ?? null),
                gradeParam: normalizeJsonField(h.status ?? h.grade ?? h.statuses ?? null),
                referenceParam: normalizeJsonField(h.references ?? h.reference ?? h.ref ?? null),
            };
        });

        const itemsToInsert = normalized.filter((it) => it.hadithNo != null);
        const skipped = normalized.length - itemsToInsert.length;
        if (itemsToInsert.length === 0) {
            if (skipped > 0) console.log(`    • skipped ${skipped} entries without hadith number for ${editionNameParam}`);
            return;
        }

        for (const it of itemsToInsert) {
            try {
                await client.query(
                    `INSERT INTO hadith (edition_name, hadith_no, book, chapter, text, text_arabic, grade, reference, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb, now())
                     ON CONFLICT (edition_name, hadith_no) DO UPDATE
                     SET book = EXCLUDED.book, chapter = EXCLUDED.chapter, text = EXCLUDED.text, text_arabic = EXCLUDED.text_arabic, grade = EXCLUDED.grade, reference = EXCLUDED.reference`,
                    [editionNameParam, it.hadithNo, it.bookField, it.chapterVal, it.text, it.textArabic, it.gradeParam, it.referenceParam],
                );
                totalHadiths++;
            } catch (e) {
                console.warn(`    ⚠️  failed inserting hadith ${it.hadithNo} for ${editionNameParam}:`, errorToLog(e));
                // continue with next item
            }
        }
        if (skipped > 0) console.log(`    • skipped ${skipped} entries without hadith number for ${editionNameParam}`);
    }

    // Helper to produce a nicer title when only edition name exists
    function titleFromEdition(name: string) {
        return name && name.includes('-') ? name.split('-').map(Boolean).join(' ') : name;
    }

    for (const b of booksArr) {
        // Normalize known keys from hadithapi response
        const bookName = asOptionalString(b.bookName);
        const slug =
            asOptionalString(b.bookSlug) ||
            asOptionalString(b.slug) ||
            (bookName ? bookName.toLowerCase().replace(/\s+/g, "-") : null);
        const title =
            bookName ||
            asOptionalString(b.title) ||
            asOptionalString(b.name) ||
            asOptionalString(b.book) ||
            String(slug || "unknown");
        const editionName = slug || title;

        if (!editionName) continue;

        // Upsert edition
        try {
            await client.query(
                `INSERT INTO hadith_editions (name, title, language, created_at, updated_at)
                 VALUES ($1,$2,$3, now(), now())
                 ON CONFLICT (name) DO UPDATE SET title = EXCLUDED.title, updated_at = now()`,
                [editionName, title, null],
            );
            editionsSaved++;
        } catch (e) {
            console.warn(`Failed to upsert edition ${editionName}:`, e);
        }

        processedEditions.add(editionName);

        // Fetch chapters for this book
        let chaptersArr: AnyRecord[] = [];
        try {
            const ch = await fetchJson(`${API_BASE}/${encodeURIComponent(editionName)}/chapters?apiKey=${encodeURIComponent(HADITH_API_KEY)}`);
            chaptersArr = arrayFromPayload(ch, ["chapters", "data"]);
        } catch (e) {
            console.warn(`  ⚠️  chapters fetch failed for ${editionName}:`, e);
            chaptersArr = [];
        }

        console.log(`  • ${title}: ${chaptersArr.length} chapters`);

        if (chaptersArr.length > 0) {
            for (const ch of chaptersArr) {
                const chapterNo = ch.chapterNumber ?? ch.chapter_no ?? ch.number ?? ch.id ?? ch.chapter ?? null;
                if (chapterNo == null) continue;

                let hadithsRes: unknown;
                try {
                    const url = `${API_BASE}/hadiths?apiKey=${encodeURIComponent(HADITH_API_KEY)}&book=${encodeURIComponent(editionName)}&chapter=${encodeURIComponent(String(chapterNo))}&paginate=500`;
                    hadithsRes = await fetchJson(url);
                } catch (e) {
                    console.warn(`    ⚠️  hadiths fetch failed for ${editionName} chapter ${chapterNo}:`, e);
                    continue;
                }

                const hadithList = arrayFromPayload(hadithsRes, ["hadiths", "data", "hadith"]);

                await processHadithList(hadithList, editionName, Number(chapterNo));
            }
        } else {
            // Some books return zero chapters but /hadiths?book=slug returns full hadiths
            try {
                const url = `${API_BASE}/hadiths?apiKey=${encodeURIComponent(HADITH_API_KEY)}&book=${encodeURIComponent(editionName)}&paginate=500`;
                const hadithsRes = await fetchJson(url);
                const hadithList = arrayFromPayload(hadithsRes, ["hadiths", "data", "hadith"]);

                await processHadithList(hadithList, editionName, null);
            } catch {
                // already logged in fetchJson
            }
        }

        console.log(`  ✓ ${title} processed`);
    }

    // If primary source yielded few or no hadiths, attempt fallback to CDN editions (legacy source)
    if (totalHadiths === 0) {
        console.log('\nNo hadiths saved from hadithapi.com — trying fallback CDN source (fawazahmed0/hadith-api)...');
        try {
            const editionsRaw: unknown = await fetchWithFallback(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions`, `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions.json`);
            const editionNames: string[] = [];
            if (Array.isArray(editionsRaw)) {
                for (const e of editionsRaw) {
                    if (typeof e === 'string') editionNames.push(e);
                    else if (e && typeof e === 'object' && 'name' in e && typeof (e as {name: unknown}).name === 'string') {
                        editionNames.push((e as {name: string}).name);
                    }
                }
            } else if (editionsRaw && typeof editionsRaw === 'object') {
                for (const v of Object.values(editionsRaw)) {
                    if (!v || typeof v !== 'object') continue;
                    if ("collection" in v && Array.isArray(v.collection)) {
                        for (const item of v.collection) {
                            if (item && typeof item === "object" && "name" in item && typeof (item as { name: unknown }).name === "string") {
                                editionNames.push((item as { name: string }).name);
                            }
                        }
                    } else if (Array.isArray(v)) {
                        for (const item of v) {
                            if (item && typeof item === "object" && "name" in item && typeof (item as { name: unknown }).name === "string") {
                                editionNames.push((item as { name: string }).name);
                            }
                        }
                    }
                }
            }

            console.log(`   ✅ ${editionNames.length} fallback editions discovered.`);
            for (const name of editionNames) {
                if (processedEditions.has(name)) continue;
                try {
                    const editionBase = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${name}`;
                    const rawEdition = `https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/${name}.json`;
                    const editionData = await fetchWithFallback(editionBase, rawEdition);

                    const hadithList = arrayFromPayload(editionData, ["hadiths", "hadis", "data"]);

                    // Upsert edition
                    const editionDataRecord = isRecord(editionData) ? editionData : {};
                    const rawInfo = editionDataRecord.info ?? editionDataRecord.meta ?? null;
                    const infoParam = normalizeJsonField(rawInfo);
                    await client.query(
                        `INSERT INTO hadith_editions(name, title, language, translator, total_hadith, info, created_at, updated_at)
                         VALUES($1,$2,$3,$4,$5,$6::jsonb,now(),now())
                         ON CONFLICT (name) DO UPDATE
                         SET title=EXCLUDED.title, language=EXCLUDED.language, translator=EXCLUDED.translator, total_hadith=EXCLUDED.total_hadith, info=EXCLUDED.info, updated_at=now()` ,
                        [
                            name,
                            asOptionalString(editionDataRecord.title) ||
                              asOptionalString(editionDataRecord.name) ||
                              name,
                            asOptionalString(editionDataRecord.language) ||
                              asOptionalString(editionDataRecord.lang),
                            asOptionalString(editionDataRecord.translator) ||
                              asOptionalString(editionDataRecord.translatedBy),
                            hadithList.length,
                            infoParam,
                        ],
                    );

                    await processHadithList(hadithList, name, null);
                    console.log(`   • fallback ${name}: ${hadithList.length} hadiths processed.`);
                } catch (err) {
                    console.error(`   ⚠️  fallback failed for ${name}:`, err);
                    try { await client.query('ROLLBACK'); } catch {}
                }
            }
        } catch (e) {
            console.warn('Fallback CDN editions fetch failed:', e);
        }
    }

    console.log(`\n   ✅ Seeding complete: ${editionsSaved} editions processed, ~${totalHadiths} hadiths saved.\n`);

    await client.end();
    console.log('\n🎉 Done');
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
