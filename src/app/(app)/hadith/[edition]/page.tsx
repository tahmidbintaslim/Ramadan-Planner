import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  id: number;
  hadithNo: number | null;
  book: string | null;
  chapter: string | null;
  text: string;
  textArabic: string | null;
  reference: unknown;
};

export default async function EditionPage({
  params,
}: {
  params: { edition: string };
}) {
  const t = await getTranslations("hadith");
  const tCommon = await getTranslations("common");
  const editionName = decodeURIComponent(params.edition || "");

  const edition = await prisma.hadithEdition.findUnique({
    where: { name: editionName },
  });

  const rows = await prisma.hadith.findMany({
    where: { editionName },
    select: {
      id: true,
      hadithNo: true,
      book: true,
      chapter: true,
      text: true,
      textArabic: true,
      reference: true,
    },
    orderBy: { hadithNo: "asc" },
  });

  // Group by chapter (fallback to book or 'General')
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.chapter || r.book || t("general");
    const list = map.get(key) ?? [];
    list.push({
      id: r.id,
      hadithNo: r.hadithNo,
      book: r.book,
      chapter: r.chapter,
      text: r.text,
      textArabic: r.textArabic,
      reference: r.reference,
    });
    map.set(key, list);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{edition?.title ?? editionName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {edition?.language ?? t("unknownLanguage")}
          </p>
          <p className="mt-2">
            <Link href="/hadith" className="text-sm text-emerald-600">
              {t("backToList")}
            </Link>
          </p>
        </CardContent>
      </Card>

      {Array.from(map.entries()).map(([chapter, items]) => (
        <Card key={chapter}>
          <CardHeader>
            <CardTitle>{chapter}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((it) => (
                <div key={it.id} className="space-y-1">
                  <p className="text-sm font-medium">
                    {t("hadithNo", {
                      no: it.hadithNo ?? tCommon("noValue"),
                    })}
                  </p>
                  <p className="text-sm">{it.text}</p>
                  {it.textArabic && (
                    <p
                      className="text-sm font-arabic text-muted-foreground"
                      dir="rtl"
                    >
                      {it.textArabic}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
