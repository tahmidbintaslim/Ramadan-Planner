import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { formatLocalizedNumber } from "@/lib/locale-number";

type ChapterRow = {
  book: string | null;
  chapter: string | null;
  refBook: string | null;
  cnt: number;
};

const UNCATEGORIZED_CHAPTER_SLUG = "__uncategorized__";
const REF_BOOK_CHAPTER_PREFIX = "__book_";

export default async function EditionPage({
  params,
}: {
  params: Promise<{ edition?: string }> | { edition?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const editionParam = resolvedParams?.edition;
  const t = await getTranslations("hadith");
  const locale = await getLocale();

  if (!editionParam) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("editionNotFound")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("editionNotFoundDesc", { edition: "" })}
            </p>
            <div className="mt-3">
              <Link href="/hadith" className="text-sm text-primary underline">
                {t("backToList")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const edition = decodeURIComponent(editionParam);

  // fetch edition metadata
  const editionMeta = await prisma.hadithEdition.findUnique({
    where: { name: edition },
  });

  if (!editionMeta) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("editionNotFound")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("editionNotFoundDesc", { edition })}
            </p>
            <div className="mt-3">
              <Link href="/hadith" className="text-sm text-primary underline">
                {t("backToList")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // fetch distinct chapters (book + chapter) with counts
  const chapters: ChapterRow[] = await prisma.$queryRaw`
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
  const editionHadithCount = await prisma.hadith.count({
    where: { editionName: edition },
  });

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
                <span className="font-medium">
                  {editionMeta?.title ?? edition}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatLocalizedNumber(chapters.length, locale)} chapters •{" "}
                {formatLocalizedNumber(editionHadithCount, locale)} hadith
              </div>
            </div>
            <Badge variant="outline">
              {formatLocalizedNumber(editionHadithCount, locale)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {chapters.map((c) => {
                  const rawBook = typeof c.book === "string" ? c.book.trim() : "";
                  const invalidBook =
                    !rawBook ||
                    ["true", "false", "true true", "false false", "null", "undefined"].includes(
                      rawBook.toLowerCase(),
                    );
                  const label = invalidBook
                    ? c.refBook
                      ? t("bookNumber", { value: String(c.refBook) })
                      : t("unknownBook")
                    : rawBook;
                  const rawChapter = c.chapter?.trim() ?? "";
                  const chapterLabel = rawChapter ||
                    (c.refBook ? t("bookNumber", { value: String(c.refBook) }) : t("unknownChapter"));
                  const normalizedChapter = rawChapter
                    ? rawChapter
                    : c.refBook
                      ? `${REF_BOOK_CHAPTER_PREFIX}${String(c.refBook)}__`
                      : UNCATEGORIZED_CHAPTER_SLUG;
                  const slug = encodeURIComponent(normalizedChapter);
                  return (
                    <Card key={`${label}-${chapterLabel}`}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatLocalizedNumber(c.cnt, locale)}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm">{chapterLabel}</p>
                          <Link
                            href={`/hadith/${edition}/${slug}`}
                            className="text-sm text-primary underline"
                          >
                            {t("viewChapter")}
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
