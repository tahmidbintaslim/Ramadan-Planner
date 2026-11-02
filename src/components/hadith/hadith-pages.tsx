import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/shared/link";
import { HadithAudioControls } from "@/components/hadith/hadith-audio-controls";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { formatLocalizedNumber } from "@/lib/locale-number";
import type { HadithChapterData, HadithEditionData, HadithListData } from "@/actions/hadith";

// Presentational ports of src/app/(app)/hadith/**/page.tsx; the data comes from the route loaders.
// Kept in sync with src/server/hadith-impl.ts (the slug constants).
const UNCATEGORIZED_CHAPTER_SLUG = "__uncategorized__";
const REF_BOOK_CHAPTER_PREFIX = "__book_";

export function HadithEditionsPage({ data }: { data: HadithListData }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  const { editions, loadError } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loadError && <p className="text-sm text-amber-600">{t("loadError")}</p>}
            {editions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {editions.map((ed) => (
                  <Card key={ed.editionName} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3">
                        <Link
                          href={`/hadith/${encodeURIComponent(ed.editionName)}`}
                          className="font-medium truncate block max-w-xs"
                        >
                          {ed.editionLabel}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge variant="ghost" className="text-muted-foreground hidden sm:inline">
                            {"key" in ed.language ? t(ed.language.key) : ed.language.text}
                          </Badge>
                          <Badge variant="outline">{formatLocalizedNumber(ed.count, locale)}</Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          {t("editionSummary", { count: formatLocalizedNumber(ed.count, locale) })}
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

function ErrorCard({ title }: { title?: string }) {
  const t = useTranslations("hadith");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title ?? t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-600">{t("loadError")}</p>
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

export function HadithEditionPage({
  data,
}: {
  data: Exclude<HadithEditionData, { kind: "not_found" }>;
}) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  if (data.kind === "error") return <ErrorCard />;
  const { chapters, hadithCount, title, editionName } = data;

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
                <span className="font-medium">{title ?? editionName}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatLocalizedNumber(chapters.length, locale)} chapters •{" "}
                {formatLocalizedNumber(hadithCount, locale)} hadith
              </div>
            </div>
            <Badge variant="outline">{formatLocalizedNumber(hadithCount, locale)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {chapters.map((c, index) => {
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
                  const chapterLabel =
                    rawChapter ||
                    (c.refBook ? t("bookNumber", { value: String(c.refBook) }) : t("unknownChapter"));
                  const normalizedChapter = rawChapter
                    ? rawChapter
                    : c.refBook
                      ? `${REF_BOOK_CHAPTER_PREFIX}${String(c.refBook)}__`
                      : UNCATEGORIZED_CHAPTER_SLUG;
                  return (
                    <Card key={`${label}-${chapterLabel}-${index}`}>
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
                            href={`/hadith/${encodeURIComponent(editionName)}/${encodeURIComponent(normalizedChapter)}`}
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

export function HadithChapterPage({
  data,
}: {
  data: Exclude<HadithChapterData, { kind: "not_found" }>;
}) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  if (data.kind === "error") return <ErrorCard />;
  const { editionName, editionTitle, items, chapterTitle } = data;

  const heading =
    "text" in chapterTitle
      ? chapterTitle.text
      : "bookNumber" in chapterTitle
        ? t("bookNumber", { value: chapterTitle.bookNumber })
        : t("unknownChapter");

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
                <Link href={`/hadith/${encodeURIComponent(editionName)}`} className="underline text-sm">
                  {editionTitle ?? editionName}
                </Link>
                <span className="mx-2">/</span>
                <span className="font-medium">{heading}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatLocalizedNumber(items.length, locale)}{" "}
                {t("moreInEdition", { count: formatLocalizedNumber(items.length, locale) })}
              </div>
            </div>
            <Badge variant="outline">{formatLocalizedNumber(items.length, locale)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-4">
              {items.map((it) => {
                const left =
                  it.bookLabel || (it.refBook !== null ? t("bookNumber", { value: it.refBook }) : "");
                const right = it.chapterLabel || (it.refChapter ?? "");
                return (
                  <Card key={it.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="font-medium">{it.hadithNo ?? t("noNumber")}</span>
                        <Badge variant="ghost" className="text-muted-foreground">
                          {/* placeholder for grade or lang */}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-muted-foreground text-sm">
                        {[left, right].filter(Boolean).join(" • ")}
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
                      {!it.textArabic && editionName.startsWith("ara-") && (
                        <p
                          className="text-sm font-arabic text-muted-foreground mt-3 leading-relaxed"
                          dir="rtl"
                        >
                          {it.text}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-relaxed">{it.english ?? t("noEnglishMeaning")}</p>
                      <p className="mt-2 text-sm leading-relaxed">{it.bengali ?? t("noBengaliMeaning")}</p>
                      <HadithAudioControls
                        arabicText={it.textArabic ?? it.text}
                        fallbackText={it.english || it.text}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          <p className="mt-2">
            <Link href={`/hadith/${encodeURIComponent(editionName)}`} className="text-sm text-emerald-600">
              {t("backToList")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
