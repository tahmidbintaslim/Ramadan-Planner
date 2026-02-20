import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { formatLocalizedNumber } from "@/lib/locale-number";

type ChapterRow = {
  book: string | null;
  chapter: string | null;
  cnt: number;
};

export default async function EditionPage({
  params,
}: {
  params: { edition: string };
}) {
  const { edition } = params;
  const t = await getTranslations("hadith");
  const locale = await getLocale();

  // fetch edition metadata
  const editionMeta = await prisma.hadithEdition.findUnique({
    where: { name: edition },
  });

  // fetch distinct chapters (book + chapter) with counts
  const chapters: ChapterRow[] = await prisma.$queryRaw`
    SELECT book, chapter, count(*) AS cnt
    FROM hadith
    WHERE edition_name = ${edition}
    GROUP BY book, chapter
    ORDER BY book NULLS FIRST, chapter NULLS FIRST
  `;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{editionMeta?.title ?? edition}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {chapters.map((c) => {
                  const label = c.book ?? t("unknownBook");
                  const chapterLabel = c.chapter ?? t("unknownChapter");
                  const slug = encodeURIComponent(String(c.chapter ?? ""));
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
