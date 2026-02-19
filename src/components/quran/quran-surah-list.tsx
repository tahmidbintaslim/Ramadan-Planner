"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search } from "lucide-react";
import type { SurahInfo } from "@/lib/quran";
import { formatLocalizedNumber } from "@/lib/locale-number";

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

export function QuranSurahList() {
  const t = useTranslations("quranReader");
  const locale = useLocale();
  const showBengaliName = locale.startsWith("bn");
  const [surahs, setSurahs] = useState<SurahInfo[]>(FALLBACK_SURAHS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
      String(surah.surahNo).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <span>{t("totalSurahs", { count: formatLocalizedNumber(surahs.length, locale) })}</span>
        {searchQuery && (
          <Badge variant="secondary">
            {t("found", { count: formatLocalizedNumber(filteredSurahs.length, locale) })}
          </Badge>
        )}
      </div>

      {/* Surah grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))
          : filteredSurahs.map((surah) => (
              <Link key={surah.surahNo} href={`/quran/${surah.surahNo}`}>
                <Card className="hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer group">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {formatLocalizedNumber(surah.surahNo, locale)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {showBengaliName
                            ? (surah.nameBengali || surah.nameEnglish)
                            : surah.nameEnglish}
                        </p>
                        <p className="text-base font-arabic shrink-0" dir="rtl">
                          {surah.nameArabic}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate">
                          {surah.nameTranslation}
                        </p>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {formatLocalizedNumber(surah.totalAyah, locale)} {t("ayahs")}
                        </p>
                      </div>
                      <Badge variant="outline" className="mt-1 text-[10px] h-4">
                        {surah.revelationPlace === "Mecca"
                          ? t("meccan")
                          : t("medinan")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      {filteredSurahs.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          {t("noResults")}
        </div>
      )}
    </div>
  );
}
