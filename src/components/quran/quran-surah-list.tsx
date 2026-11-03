"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { ChevronRightIcon, QuranIcon } from "@/components/icons/islamic-icons";
import { Search } from "lucide-react";
import type { SurahInfo } from "@/lib/quran";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { lastReadHref, readLastRead, type LastRead } from "@/lib/quran-last-read";

// Embedded fallback for the first 10 surahs (pre-seed safety net)
const FALLBACK_SURAHS: SurahInfo[] = [
  {
    surahNo: 1,
    nameArabic: "الفاتحة",
    nameArabicLong: "سُورَةُ ٱلْفَاتِحَةِ",
    nameEnglish: "Al-Faatiha",
    nameTranslation: "The Opening",
    nameBengali: "আল-ফাতিহা",
    revelationPlace: "Mecca",
    totalAyah: 7,
  },
  {
    surahNo: 2,
    nameArabic: "البقرة",
    nameArabicLong: "سورة البقرة",
    nameEnglish: "Al-Baqara",
    nameTranslation: "The Cow",
    nameBengali: "আল-বাকারা",
    revelationPlace: "Madina",
    totalAyah: 286,
  },
  {
    surahNo: 3,
    nameArabic: "آل عمران",
    nameArabicLong: "سورة آل عمران",
    nameEnglish: "Aal-i-Imraan",
    nameTranslation: "The Family of Imraan",
    nameBengali: "আলে ইমরান",
    revelationPlace: "Madina",
    totalAyah: 200,
  },
  {
    surahNo: 4,
    nameArabic: "النساء",
    nameArabicLong: "سورة النساء",
    nameEnglish: "An-Nisaa",
    nameTranslation: "The Women",
    nameBengali: "আন-নিসা",
    revelationPlace: "Madina",
    totalAyah: 176,
  },
  {
    surahNo: 5,
    nameArabic: "المائدة",
    nameArabicLong: "سورة المائدة",
    nameEnglish: "Al-Maaida",
    nameTranslation: "The Table Spread",
    nameBengali: "আল-মায়িদা",
    revelationPlace: "Madina",
    totalAyah: 120,
  },
  {
    surahNo: 6,
    nameArabic: "الأنعام",
    nameArabicLong: "سورة الأنعام",
    nameEnglish: "Al-An'aam",
    nameTranslation: "The Cattle",
    nameBengali: "আল-আনআম",
    revelationPlace: "Mecca",
    totalAyah: 165,
  },
  {
    surahNo: 7,
    nameArabic: "الأعراف",
    nameArabicLong: "سورة الأعراف",
    nameEnglish: "Al-A'raaf",
    nameTranslation: "The Heights",
    nameBengali: "আল-আরাফ",
    revelationPlace: "Mecca",
    totalAyah: 206,
  },
  {
    surahNo: 8,
    nameArabic: "الأنفال",
    nameArabicLong: "سورة الأنفال",
    nameEnglish: "Al-Anfaal",
    nameTranslation: "The Spoils of War",
    nameBengali: "আল-আনফাল",
    revelationPlace: "Madina",
    totalAyah: 75,
  },
  {
    surahNo: 9,
    nameArabic: "التوبة",
    nameArabicLong: "سورة التوبة",
    nameEnglish: "At-Tawba",
    nameTranslation: "The Repentance",
    nameBengali: "আত-তাওবা",
    revelationPlace: "Madina",
    totalAyah: 129,
  },
  {
    surahNo: 10,
    nameArabic: "يونس",
    nameArabicLong: "سورة يونس",
    nameEnglish: "Yunus",
    nameTranslation: "Jonah",
    nameBengali: "ইউনুস",
    revelationPlace: "Mecca",
    totalAyah: 109,
  },
];


// Only the surah index is available from the data today. Para (juz) and page indexes and bookmarks have no data
// source yet, so those tabs are shown disabled with "শীঘ্রই" (soon) instead of pretending to work.
const TABS = ["surah", "para", "page", "bookmark"] as const;

function LastReadCard({ surah, lastRead: saved }: { surah: SurahInfo | undefined; lastRead: LastRead }) {
  const t = useTranslations("quranReader");
  // Never point past the end of the surah (stale or hand-edited storage).
  const lastRead: LastRead = surah ? { ...saved, ayah: Math.max(1, Math.min(saved.ayah, surah.totalAyah)) } : saved;
  const locale = useLocale();
  const name = surah
    ? locale.startsWith("bn")
      ? surah.nameBengali || surah.nameEnglish
      : surah.nameEnglish
    : t("surahFallback", { n: formatLocalizedNumber(lastRead.surah, locale) });

  return (
    <section
      aria-label={t("lastRead")}
      data-testid="last-read-card"
      className="relative overflow-hidden rounded-rp-lg p-5 text-white shadow-rp-soft"
      style={{ background: "var(--rp-gradient-quran)" }}
    >
      <GirihPattern opacity={0.08} className="text-white" />
      <MihrabArch className="pointer-events-none absolute -right-4 bottom-0 h-full w-auto text-white" />
      <div className="relative flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-rp-gold">
          <QuranIcon size={56} strokeWidth={1.4} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="rp-caption text-white">{t("lastRead")}</p>
          <h2 className="rp-h2 truncate text-white">{name}</h2>
          <p className="rp-small text-white">{t("lastReadAyah", { n: formatLocalizedNumber(lastRead.ayah, locale) })}</p>
        </div>
      </div>
      <Link
        href={lastReadHref(lastRead)}
        className="relative mt-4 inline-flex min-h-12 items-center gap-2 rounded-rp-full bg-black/25 px-5 text-[14px] font-semibold text-white outline-none transition-colors hover:bg-black/35 focus-visible:ring-[3px] focus-visible:ring-white"
      >
        {t("continueReading")}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export function QuranSurahList() {
  const t = useTranslations("quranReader");
  const locale = useLocale();
  const showBengaliName = locale.startsWith("bn");
  const [surahs, setSurahs] = useState<SurahInfo[]>(FALLBACK_SURAHS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRead, setLastRead] = useState<LastRead | null>(null);

  // localStorage is read after mount so the server and first client render agree (no card until known).
  useEffect(() => {
    setLastRead(readLastRead());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch("/api/quran", { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data: SurahInfo[] = await res.json();
          if (data.length > 0) setSurahs(data);
        }
      } catch {
        // Fallback is already set
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSurahs = surahs.filter((surah) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      surah.nameEnglish.toLowerCase().includes(q) ||
      surah.nameTranslation.toLowerCase().includes(q) ||
      surah.nameArabic.includes(q) ||
      surah.nameBengali.includes(q) ||
      String(surah.surahNo).includes(q) ||
      formatLocalizedNumber(surah.surahNo, "bn").includes(q)
    );
  });

  const lastReadSurah = lastRead ? surahs.find((s) => s.surahNo === lastRead.surah) : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="rp-h1 text-rp-ink">{t("listTitle")}</h1>
        <p className="rp-small text-rp-muted">
          {t("listCaption", { count: formatLocalizedNumber(surahs.length, locale) })}
        </p>
      </div>

      {lastRead ? <LastReadCard surah={lastReadSurah} lastRead={lastRead} /> : null}

      <div role="group" aria-label={t("tabsLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((tab) => {
          const active = tab === "surah";
          return (
            <Chip key={tab} selected={active} disabled={!active} data-tab={tab}>
              {t(`tab.${tab}`)}
              {active ? null : <span className="sr-only"> ({t("soon")})</span>}
            </Chip>
          );
        })}
      </div>

      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-rp-muted" />
        <Input
          type="search"
          aria-label={t("searchPlaceholder")}
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-rp-full border-rp-input bg-rp-surface pl-11"
        />
      </div>
      {searchQuery ? (
        <p role="status" className="rp-small text-rp-muted">
          {t("found", { count: formatLocalizedNumber(filteredSurahs.length, locale) })}
        </p>
      ) : null}

      <Card className="gap-0 overflow-hidden py-0">
        {loading ? (
          <div role="status" aria-label={t("loading")} className="divide-y divide-rp-rule">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex min-h-16 items-center gap-3 px-4">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-rp-rule" data-testid="surah-list">
            {filteredSurahs.map((surah) => (
              <li key={surah.surahNo}>
                <Link
                  href={`/quran/${surah.surahNo}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-2 outline-none transition-colors hover:bg-rp-accent-tint/60 focus-visible:bg-rp-accent-tint/60 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rp-accent-tint text-[14px] font-semibold text-rp-accent"
                  >
                    {formatLocalizedNumber(surah.surahNo, locale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="rp-row block truncate text-rp-ink">
                      <span className="sr-only">{formatLocalizedNumber(surah.surahNo, locale)}. </span>
                      {showBengaliName ? surah.nameBengali || surah.nameEnglish : surah.nameEnglish}
                    </span>
                    <span className="rp-caption block truncate text-rp-muted">
                      {surah.revelationPlace === "Mecca" ? t("meccan") : t("medinan")} ·{" "}
                      {formatLocalizedNumber(surah.totalAyah, locale)} {t("ayahs")}
                    </span>
                  </span>
                  <span className="font-arabic shrink-0 text-[18px] text-rp-ink" dir="rtl" lang="ar">
                    {surah.nameArabic}
                  </span>
                  <ChevronRightIcon size={20} aria-hidden="true" className="shrink-0 text-rp-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {filteredSurahs.length === 0 && !loading ? (
        <p className="py-8 text-center text-rp-muted">{t("noResults")}</p>
      ) : null}
    </div>
  );
}
