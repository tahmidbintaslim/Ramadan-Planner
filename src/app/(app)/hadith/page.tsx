import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { formatLocalizedNumber } from "@/lib/locale-number";

type HadithItem = {
  id: string;
  editionLabel: string;
  hadithNo: number | null;
  textEn: string | null;
  textBn: string | null;
  textAr: string | null;
  reference: unknown;
};

type TranslationFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export default async function HadithPage() {
  const t = await getTranslations("hadith");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();

  let hadiths: HadithItem[] = [];
  let editions: {
    editionName: string;
    editionLabel: string;
    language: string | null;
    items: {
      id: string;
      hadithNo: number | null;
      text: string;
      textArabic: string | null;
      reference: unknown;
    }[];
  }[] = [];

  let loadError = false;

  try {
    const data = await prisma.hadith.findMany({
      select: {
        id: true,
        editionName: true,
        hadithNo: true,
        text: true,
        textArabic: true,
        reference: true,
        edition: {
          select: {
            language: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    // Build a map of editions -> items so we can render each edition as a "book" card
    const editionsMap = new Map<
      string,
      {
        editionLabel: string;
        language: string | null;
        items: {
          id: string;
          hadithNo: number | null;
          text: string;
          textArabic: string | null;
          reference: unknown;
        }[];
      }
    >();

    for (const item of data) {
      const editionName = item.editionName || String(item.id);
      const label =
        item.edition?.title || item.editionName || t("unknownEdition");
      const language = item.edition?.language ?? null;

      const existing = editionsMap.get(editionName) ?? {
        editionLabel: label,
        language,
        items: [],
      };

      existing.items.push({
        id: String(item.id),
        hadithNo: item.hadithNo,
        text: item.text,
        textArabic: item.textArabic,
        reference: item.reference,
      });

      editionsMap.set(editionName, existing);
    }

    editions = Array.from(editionsMap.entries())
      .slice(0, 50)
      .map(([editionName, v]) => ({
        editionName,
        editionLabel: v.editionLabel,
        language: v.language,
        items: v.items,
      }));

    // Also populate a flattened hadiths list (legacy UI/logic)
    hadiths = editions.flatMap((ed) =>
      ed.items.slice(0, 10).map((it) => ({
        id: it.id,
        editionLabel: ed.editionLabel,
        hadithNo: it.hadithNo,
        textEn:
          ed.language && ed.language.toLowerCase().includes("english")
            ? it.text
            : null,
        textBn:
          ed.language &&
          (ed.language.toLowerCase().includes("bengali") ||
            ed.language.toLowerCase().includes("bangla"))
            ? it.text
            : null,
        textAr: it.textArabic || null,
        reference: it.reference,
      })),
    );
  } catch (err) {
    console.error("Failed to load hadiths from hadith table", err);
    loadError = true;

    // Fallback: reuse daily_content hadith snippets so page stays useful.
    try {
      const fallback = await prisma.dailyContent.findMany({
        select: {
          id: true,
          day: true,
          hadithBn: true,
          hadithEn: true,
          hadithAr: true,
          hadithRef: true,
        },
        orderBy: { day: "asc" },
        take: 20,
      });

      hadiths = fallback.map((item) => ({
        id: String(item.id),
        editionLabel: t("dailyEdition"),
        hadithNo: item.day,
        textEn: item.hadithEn,
        textBn: item.hadithBn,
        textAr: item.hadithAr,
        reference: item.hadithRef,
      }));
    } catch (fallbackError) {
      console.error("Fallback hadith load failed", fallbackError);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loadError && (
              <p className="text-sm text-amber-600">{t("loadError")}</p>
            )}
            {hadiths.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              // Render editions as book-style cards
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {editions.map((ed) => (
                  <Card key={ed.editionName}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <Link
                          href={`/hadith/${encodeURIComponent(ed.editionName)}`}
                          className="font-medium"
                        >
                          {ed.editionLabel}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {ed.language ?? t("unknownLanguage")} •{" "}
                          {formatLocalizedNumber(ed.items.length, locale)}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {ed.items.slice(0, 10).map((it) => (
                          <div key={it.id} className="p-3 border rounded-md">
                            <p className="text-sm font-medium">
                              {t("edition", {
                                edition: ed.editionLabel,
                                no:
                                  it.hadithNo !== null
                                    ? formatLocalizedNumber(it.hadithNo, locale)
                                    : tCommon("noValue"),
                              })}
                            </p>
                            {it.text && (
                              <p className="text-sm mt-1">{it.text}</p>
                            )}
                            {it.textArabic && (
                              <p
                                className="text-sm font-arabic text-muted-foreground mt-1"
                                dir="rtl"
                              >
                                {it.textArabic}
                              </p>
                            )}
                            {hasReference(it.reference) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatReference(it.reference, t)}
                              </p>
                            )}
                          </div>
                        ))}
                        {ed.items.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            {t("moreInEdition", {
                              count: formatLocalizedNumber(
                                ed.items.length - 10,
                                locale,
                              ),
                            })}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatReference(ref: unknown, t: TranslationFn) {
  if (ref == null) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object") {
    try {
      const r = ref as Record<string, unknown>;
      const parts: string[] = [];
      if (r.book)
        parts.push(
          typeof r.book === "object" ? JSON.stringify(r.book) : String(r.book),
        );
      if (r.chapter) parts.push(t("refChapter", { value: String(r.chapter) }));
      if (r.hadith) parts.push(t("refHadith", { value: String(r.hadith) }));
      if (r.collection) parts.push(String(r.collection));
      if (parts.length) return parts.join(" • ");
      return JSON.stringify(ref);
    } catch {
      return String(ref);
    }
  }
  return String(ref);
}

function hasReference(ref: unknown): boolean {
  return ref !== null && ref !== undefined && ref !== "";
}
