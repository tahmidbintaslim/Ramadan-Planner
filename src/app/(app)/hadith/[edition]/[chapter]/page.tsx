import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { formatLocalizedNumber } from "@/lib/locale-number";
import Link from "next/link";

export default async function ChapterPage({
  params,
}: {
  params: { edition: string; chapter: string };
}) {
  const { edition, chapter } = params;
  const t = await getTranslations("hadith");
  const locale = await getLocale();

  const chapterDecoded = decodeURIComponent(chapter || "");

  const items = await prisma.hadith.findMany({
    where: { editionName: edition, chapter: chapterDecoded },
    orderBy: [{ hadithNo: "asc" }, { id: "asc" }],
    take: 1000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{`${edition} — ${chapterDecoded}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="space-y-4">
                {items.map((it) => (
                  <Card key={it.id}>
                    <CardContent>
                      <p className="text-sm font-medium">
                        {it.hadithNo ?? t("noNumber")}
                      </p>
                      <p className="mt-2 text-sm">{it.text}</p>
                      {it.textArabic && (
                        <p
                          className="text-sm font-arabic text-muted-foreground mt-2"
                          dir="rtl"
                        >
                          {it.textArabic}
                        </p>
                      )}
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
