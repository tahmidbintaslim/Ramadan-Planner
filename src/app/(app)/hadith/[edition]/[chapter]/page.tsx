import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { formatLocalizedNumber } from "@/lib/locale-number";
import Link from "next/link";
import { HadithAudioControls } from "@/components/hadith/hadith-audio-controls";

const UNCATEGORIZED_CHAPTER_SLUG = "__uncategorized__";

function normalizeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const lowered = trimmed.toLowerCase();
  if (
    lowered === "true" ||
    lowered === "false" ||
    lowered === "true true" ||
    lowered === "false false" ||
    lowered === "null" ||
    lowered === "undefined"
  ) {
    return "";
  }

  return trimmed;
}

function parseReferenceField(
  reference: unknown,
): { book?: string | number; chapter?: string | number; hadith?: string | number } {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    return {};
  }

  const obj = reference as Record<string, unknown>;
  const book = obj.book;
  const chapter = obj.chapter;
  const hadith = obj.hadith;

  return {
    book: typeof book === "number" || typeof book === "string" ? book : undefined,
    chapter:
      typeof chapter === "number" || typeof chapter === "string"
        ? chapter
        : undefined,
    hadith:
      typeof hadith === "number" || typeof hadith === "string" ? hadith : undefined,
  };
}

function getEditionBaseName(edition: string): string {
  const parts = edition.split("-");
  if (parts.length >= 2 && parts[0].length === 3) {
    return parts.slice(1).join("-");
  }
  return edition;
}

export default async function ChapterPage({
  params,
}: {
  params:
    | Promise<{ edition: string; chapter: string }>
    | { edition: string; chapter: string };
}) {
  const { edition, chapter } = await Promise.resolve(params);
  const t = await getTranslations("hadith");
  const locale = await getLocale();

  const chapterDecoded = decodeURIComponent(chapter || "");
  const refBookMatch = chapterDecoded.match(/^__book_(.+)__$/);
  const refBookFilter = refBookMatch?.[1] ?? null;

  const editionMeta = await prisma.hadithEdition.findUnique({
    where: { name: edition },
  });

  const chapterWhere =
    refBookFilter
      ? {
          OR: [{ chapter: null }, { chapter: "" }],
          reference: {
            path: ["book"],
            equals: Number.isNaN(Number(refBookFilter))
              ? refBookFilter
              : Number(refBookFilter),
          },
        }
      : chapterDecoded === UNCATEGORIZED_CHAPTER_SLUG
      ? {
          OR: [{ chapter: null }, { chapter: "" }],
        }
      : {
          chapter: chapterDecoded,
        };

  const items = await prisma.hadith.findMany({
    where: { editionName: edition, ...chapterWhere },
    orderBy: [{ hadithNo: "asc" }, { id: "asc" }],
    take: 1000,
  });

  const hadithNos = Array.from(
    new Set(
      items
        .map((item) => item.hadithNo)
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  const editionBase = getEditionBaseName(edition);
  const [englishRows, bengaliRows] = await Promise.all([
    hadithNos.length > 0
      ? prisma.hadith.findMany({
          where: {
            editionName: `eng-${editionBase}`,
            hadithNo: { in: hadithNos },
          },
          select: { hadithNo: true, text: true },
        })
      : Promise.resolve([]),
    hadithNos.length > 0
      ? prisma.hadith.findMany({
          where: {
            editionName: `ben-${editionBase}`,
            hadithNo: { in: hadithNos },
          },
          select: { hadithNo: true, text: true },
        })
      : Promise.resolve([]),
  ]);

  const englishByNo = new Map<number, string>();
  for (const row of englishRows) {
    if (typeof row.hadithNo === "number" && row.text.trim()) {
      englishByNo.set(row.hadithNo, row.text);
    }
  }

  const bengaliByNo = new Map<number, string>();
  for (const row of bengaliRows) {
    if (typeof row.hadithNo === "number" && row.text.trim()) {
      bengaliByNo.set(row.hadithNo, row.text);
    }
  }

  const defaultChapterTitle =
    refBookFilter
      ? t("bookNumber", { value: refBookFilter })
      : chapterDecoded === UNCATEGORIZED_CHAPTER_SLUG
      ? (() => {
          const first = items[0];
          if (!first) return t("unknownChapter");
          const ref = parseReferenceField(first.reference);
          if (ref.chapter !== undefined) return String(ref.chapter);
          if (ref.book !== undefined) return t("bookNumber", { value: String(ref.book) });
          return t("unknownChapter");
        })()
      : chapterDecoded;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                <Link href="/hadith" className="underline text-sm">
                  {t("backToList")}
                </Link>
                <span className="mx-2">/</span>
                <Link
                  href={`/hadith/${encodeURIComponent(edition)}`}
                  className="underline text-sm"
                >
                  {editionMeta?.title ?? edition}
                </Link>
                <span className="mx-2">/</span>
                <span className="font-medium">
                  {defaultChapterTitle}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatLocalizedNumber(items.length, locale)}{" "}
                {t("moreInEdition", {
                  count: formatLocalizedNumber(items.length, locale),
                })}
              </div>
            </div>
            <Badge variant="outline">
              {formatLocalizedNumber(items.length, locale)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="space-y-4">
                {items.map((it) => (
                  <Card key={it.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="font-medium">
                          {it.hadithNo ?? t("noNumber")}
                        </span>
                        <Badge
                          variant="ghost"
                          className="text-muted-foreground"
                        >
                          {/* placeholder for grade or lang */}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-muted-foreground text-sm">
                        {(() => {
                          const bookLabel = normalizeLabel(it.book);
                          const chapterLabel = normalizeLabel(it.chapter);
                          const ref = parseReferenceField(it.reference);
                          const fallbackBook =
                            ref.book !== undefined
                              ? t("bookNumber", { value: String(ref.book) })
                              : "";
                          const fallbackChapter =
                            ref.chapter !== undefined ? String(ref.chapter) : "";
                          const left = bookLabel || fallbackBook;
                          const right = chapterLabel || fallbackChapter;
                          return [left, right].filter(Boolean).join(" • ");
                        })()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {it.textArabic && (
                        <p
                          className="text-sm font-arabic text-muted-foreground mt-3 leading-relaxed"
                          dir="rtl"
                        >
                          {it.textArabic}
                        </p>
                      )}
                      {!it.textArabic && edition.startsWith("ara-") && (
                        <p
                          className="text-sm font-arabic text-muted-foreground mt-3 leading-relaxed"
                          dir="rtl"
                        >
                          {it.text}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-relaxed">
                        {it.hadithNo !== null && englishByNo.get(it.hadithNo)
                          ? englishByNo.get(it.hadithNo)
                          : t("noEnglishMeaning")}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">
                        {it.hadithNo !== null && bengaliByNo.get(it.hadithNo)
                          ? bengaliByNo.get(it.hadithNo)
                          : t("noBengaliMeaning")}
                      </p>
                      <HadithAudioControls
                        arabicText={it.textArabic ?? it.text}
                        fallbackText={
                          (it.hadithNo !== null && englishByNo.get(it.hadithNo)) || it.text
                        }
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2">
            <Link
              href={`/hadith/${edition}`}
              className="text-sm text-emerald-600"
            >
              {t("backToList")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
