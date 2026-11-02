// Server-only implementations of the /hadith pages' loaders (src/actions/hadith.ts). PUBLIC reads: the old
// pages had no auth. Results are plain JSON (no Map, no BigInt); labels that need translations are resolved
// in the components. Database failures never leak: they become `{ kind: "error" }` / `loadError`.
import "@tanstack/react-start/server-only";
import { setResponseStatus } from "@tanstack/react-start/server";
import { prisma } from "@/lib/prisma";

export const UNCATEGORIZED_CHAPTER_SLUG = "__uncategorized__";
export const REF_BOOK_CHAPTER_PREFIX = "__book_";

// ── /hadith ──────────────────────────────────────────────

export type EditionLanguage =
  | { key: "arabicLabel" | "bengaliLabel" | "englishLabel" | "unknownLanguage" }
  | { text: string };

export interface HadithEditionCard {
  editionName: string;
  editionLabel: string;
  language: EditionLanguage;
  count: number;
}

export interface HadithListData {
  editions: HadithEditionCard[];
  loadError: boolean;
}

function inferLanguage(editionName: string, fallbackLanguage: string | null): EditionLanguage {
  const prefix = editionName.split("-")[0]?.toLowerCase();
  if (prefix === "ara") return { key: "arabicLabel" };
  if (prefix === "ben" || prefix === "bn") return { key: "bengaliLabel" };
  if (prefix === "eng" || prefix === "en") return { key: "englishLabel" };
  if (typeof fallbackLanguage === "string" && fallbackLanguage.trim().length > 0) {
    return { text: fallbackLanguage };
  }
  return { key: "unknownLanguage" };
}

function toTitleCase(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function userFacingEditionLabel(editionName: string): string {
  const parts = editionName.split("-");
  const isLangPrefixed = parts.length > 1 && parts[0].length === 3;
  const base = isLangPrefixed ? parts.slice(1).join(" ") : editionName.replace(/-/g, " ");
  return toTitleCase(base.replace(/-/g, " ").trim());
}

export async function getHadithListImpl(): Promise<HadithListData> {
  try {
    const editionsList = await prisma.hadithEdition.findMany({
      select: { name: true, title: true, language: true, totalHadith: true },
      orderBy: { title: "asc" },
    });
    const counts: { edition_name: string; cnt: number }[] =
      await prisma.$queryRaw`SELECT edition_name, count(*)::int AS cnt FROM hadith GROUP BY edition_name`;

    const countsMap = new Map<string, number>();
    for (const r of counts) countsMap.set(String(r.edition_name), Number(r.cnt));

    const withCounts = editionsList
      .map((e) => ({
        editionName: e.name,
        editionLabel: userFacingEditionLabel(e.name),
        language: inferLanguage(e.name, e.language ?? null),
        count: countsMap.get(e.name) ?? 0,
      }))
      .filter((e) => e.count > 0);

    const byName = new Map(withCounts.map((e) => [e.editionName, e]));
    const editions = withCounts.filter((e) => {
      if (!e.editionName.endsWith("1")) return true;
      const baseEdition = byName.get(e.editionName.slice(0, -1));
      if (!baseEdition) return true;
      return baseEdition.count !== e.count;
    });
    return { editions, loadError: false };
  } catch (err) {
    console.error("Failed to load hadiths from hadith table", err);
    setResponseStatus(503);
    return { editions: [], loadError: true };
  }
}

// ── /hadith/$edition ─────────────────────────────────────

export interface HadithChapterCard {
  book: string | null;
  chapter: string | null;
  refBook: string | null;
  cnt: number;
}

export type HadithEditionData =
  | { kind: "ok"; editionName: string; title: string | null; chapters: HadithChapterCard[]; hadithCount: number }
  | { kind: "not_found" }
  | { kind: "error" };

export async function getHadithEditionImpl(edition: string): Promise<HadithEditionData> {
  if (typeof edition !== "string" || !edition) return { kind: "not_found" };
  try {
    const editionMeta = await prisma.hadithEdition.findUnique({ where: { name: edition } });
    if (!editionMeta) return { kind: "not_found" };

    const rows: Array<{ book: string | null; chapter: string | null; refBook: string | null; cnt: bigint | number }> =
      await prisma.$queryRaw`
      SELECT
        book,
        chapter,
        COALESCE(reference->>'book', NULL) AS "refBook",
        count(*) AS cnt
      FROM hadith
      WHERE edition_name = ${edition}
      GROUP BY book, chapter, COALESCE(reference->>'book', NULL)
      ORDER BY book NULLS FIRST, chapter NULLS FIRST, COALESCE(reference->>'book', NULL) NULLS FIRST
    `;
    const hadithCount = await prisma.hadith.count({ where: { editionName: edition } });

    return {
      kind: "ok",
      editionName: editionMeta.name,
      title: editionMeta.title ?? null,
      chapters: rows.map((r) => ({
        book: r.book,
        chapter: r.chapter,
        refBook: r.refBook === null || r.refBook === undefined ? null : String(r.refBook),
        cnt: Number(r.cnt),
      })),
      hadithCount,
    };
  } catch (err) {
    console.error("Failed to load hadith edition", err);
    setResponseStatus(503);
    return { kind: "error" };
  }
}

// ── /hadith/$edition/$chapter ────────────────────────────

export interface HadithItem {
  id: number;
  hadithNo: number | null;
  /** `book` / `chapter` with the junk values ("true", "null", ...) already blanked. */
  bookLabel: string;
  chapterLabel: string;
  /** From the `reference` JSON, stringified. */
  refBook: string | null;
  refChapter: string | null;
  text: string;
  textArabic: string | null;
  english: string | null;
  bengali: string | null;
}

export type HadithChapterData =
  | {
      kind: "ok";
      editionName: string;
      editionTitle: string | null;
      /** Chapter heading: text as-is, or a "book N" / unknown placeholder the component translates. */
      chapterTitle: { text: string } | { bookNumber: string } | { unknown: true };
      items: HadithItem[];
    }
  | { kind: "not_found" }
  | { kind: "error" };

function normalizeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lowered = trimmed.toLowerCase();
  if (["true", "false", "true true", "false false", "null", "undefined"].includes(lowered)) return "";
  return trimmed;
}

function parseReferenceField(reference: unknown): { book?: string | number; chapter?: string | number } {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) return {};
  const obj = reference as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "number" || typeof v === "string" ? v : undefined);
  return { book: pick(obj.book), chapter: pick(obj.chapter) };
}

function getEditionBaseName(edition: string): string {
  const parts = edition.split("-");
  if (parts.length >= 2 && parts[0].length === 3) return parts.slice(1).join("-");
  return edition;
}

/** `edition` and `chapter` are the router's already-decoded params. */
export async function getHadithChapterImpl(edition: string, chapter: string): Promise<HadithChapterData> {
  if (typeof edition !== "string" || !edition || typeof chapter !== "string" || !chapter) {
    return { kind: "not_found" };
  }
  try {
    const refBookMatch = chapter.match(/^__book_(.+)__$/);
    const refBookFilter = refBookMatch?.[1] ?? null;

    const editionMeta = await prisma.hadithEdition.findUnique({ where: { name: edition } });
    if (!editionMeta) return { kind: "not_found" };

    const chapterWhere = refBookFilter
      ? {
          OR: [{ chapter: null }, { chapter: "" }],
          reference: {
            path: ["book"],
            equals: Number.isNaN(Number(refBookFilter)) ? refBookFilter : Number(refBookFilter),
          },
        }
      : chapter === UNCATEGORIZED_CHAPTER_SLUG
        ? { OR: [{ chapter: null }, { chapter: "" }] }
        : { chapter };

    const items = await prisma.hadith.findMany({
      where: { editionName: edition, ...chapterWhere },
      orderBy: [{ hadithNo: "asc" }, { id: "asc" }],
      take: 1000,
    });
    if (items.length === 0) return { kind: "not_found" };

    const hadithNos = Array.from(
      new Set(items.map((i) => i.hadithNo).filter((v): v is number => typeof v === "number")),
    );
    const editionBase = getEditionBaseName(edition);
    const translations = (prefix: "eng" | "ben") =>
      hadithNos.length > 0
        ? prisma.hadith.findMany({
            where: { editionName: `${prefix}-${editionBase}`, hadithNo: { in: hadithNos } },
            select: { hadithNo: true, text: true },
          })
        : Promise.resolve([] as Array<{ hadithNo: number | null; text: string }>);
    const [englishRows, bengaliRows] = await Promise.all([translations("eng"), translations("ben")]);

    const toMap = (rows: Array<{ hadithNo: number | null; text: string }>) => {
      const map = new Map<number, string>();
      for (const row of rows) {
        if (typeof row.hadithNo === "number" && row.text.trim()) map.set(row.hadithNo, row.text);
      }
      return map;
    };
    const englishByNo = toMap(englishRows);
    const bengaliByNo = toMap(bengaliRows);

    let title: { text: string } | { bookNumber: string } | { unknown: true };
    if (refBookFilter) {
      title = { bookNumber: refBookFilter };
    } else if (chapter === UNCATEGORIZED_CHAPTER_SLUG) {
      const ref = parseReferenceField(items[0]?.reference);
      if (ref.chapter !== undefined) title = { text: String(ref.chapter) };
      else if (ref.book !== undefined) title = { bookNumber: String(ref.book) };
      else title = { unknown: true };
    } else {
      title = { text: chapter };
    }

    return {
      kind: "ok",
      editionName: edition,
      editionTitle: editionMeta.title ?? null,
      chapterTitle: title,
      items: items.map((it) => {
        const ref = parseReferenceField(it.reference);
        return {
          id: it.id,
          hadithNo: it.hadithNo,
          bookLabel: normalizeLabel(it.book),
          chapterLabel: normalizeLabel(it.chapter),
          refBook: ref.book !== undefined ? String(ref.book) : null,
          refChapter: ref.chapter !== undefined ? String(ref.chapter) : null,
          text: it.text,
          textArabic: it.textArabic ?? null,
          english: it.hadithNo !== null ? (englishByNo.get(it.hadithNo) ?? null) : null,
          bengali: it.hadithNo !== null ? (bengaliByNo.get(it.hadithNo) ?? null) : null,
        };
      }),
    };
  } catch (err) {
    console.error("Failed to load hadith chapter", err);
    setResponseStatus(503);
    return { kind: "error" };
  }
}
