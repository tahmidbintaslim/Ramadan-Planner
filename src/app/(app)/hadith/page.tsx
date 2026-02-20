import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { formatLocalizedNumber } from "@/lib/locale-number";

function inferLanguageFromEditionName(
  editionName: string,
  fallbackLanguage: string | null,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  const prefix = editionName.split("-")[0]?.toLowerCase();
  if (prefix === "ara") return t("arabicLabel");
  if (prefix === "ben" || prefix === "bn") return t("bengaliLabel");
  if (prefix === "eng" || prefix === "en") return t("englishLabel");
  if (typeof fallbackLanguage === "string" && fallbackLanguage.trim().length > 0) {
    return fallbackLanguage;
  }
  return t("unknownLanguage");
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

export default async function HadithPage() {
  const t = await getTranslations("hadith");
  const locale = await getLocale();

  let editions: {
    editionName: string;
    editionLabel: string;
    languageLabel: string;
    count: number;
  }[] = [];

  let loadError = false;

  try {
    // Fetch all known editions (metadata) and counts per edition from hadith table
    const editionsList = await prisma.hadithEdition.findMany({
      select: { name: true, title: true, language: true, totalHadith: true },
      orderBy: { title: "asc" },
    });

    const counts: { edition_name: string; cnt: number }[] =
      await prisma.$queryRaw`
      SELECT edition_name, count(*)::int AS cnt FROM hadith GROUP BY edition_name
    `;

    const countsMap = new Map<string, number>();
    for (const r of counts) {
      countsMap.set(String(r.edition_name), Number(r.cnt));
    }

    const withCounts = editionsList
      .map((e) => ({
        editionName: e.name,
        editionLabel: userFacingEditionLabel(e.name),
        languageLabel: inferLanguageFromEditionName(e.name, e.language ?? null, t),
        count: countsMap.get(e.name) ?? 0,
      }))
      .filter((e) => e.count > 0);

    const byName = new Map(withCounts.map((e) => [e.editionName, e]));
    editions = withCounts.filter((e) => {
      if (!e.editionName.endsWith("1")) return true;
      const base = e.editionName.slice(0, -1);
      const baseEdition = byName.get(base);
      if (!baseEdition) return true;
      return baseEdition.count !== e.count;
    });
  } catch (err) {
    console.error("Failed to load hadiths from hadith table", err);
    loadError = true;
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
            {editions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              // Render editions as book-style cards
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {editions.map((ed) => (
                  <Card
                    key={ed.editionName}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3">
                        <Link
                          href={`/hadith/${encodeURIComponent(ed.editionName)}`}
                          className="font-medium truncate block max-w-xs"
                        >
                          {ed.editionLabel}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="ghost"
                            className="text-muted-foreground hidden sm:inline"
                          >
                            {ed.languageLabel}
                          </Badge>
                          <Badge variant="outline">
                            {formatLocalizedNumber(ed.count ?? 0, locale)}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          {t("editionSummary", {
                            count: formatLocalizedNumber(ed.count ?? 0, locale),
                          })}
                        </p>
                        <p>
                          <Link
                            href={`/hadith/${encodeURIComponent(ed.editionName)}`}
                            className="text-sm text-primary underline"
                          >
                            {t("viewEdition")}
                          </Link>
                        </p>
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
