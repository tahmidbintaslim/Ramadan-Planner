"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SurahInfo } from "@/lib/quran";
import { formatLocalizedNumber } from "@/lib/locale-number";

// Embedded fallback data for the first 10 surahs — always available even if DB is empty
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

export function QuranPreview() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const showBengaliName = locale.startsWith("bn");

  const [surahs, setSurahs] = useState<SurahInfo[]>(
    FALLBACK_SURAHS.slice(0, 4),
  );
  const [totalSurahs, setTotalSurahs] = useState(114);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch("/api/quran", { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data: SurahInfo[] = await res.json();
          if (data.length > 0) {
            setSurahs(data.slice(0, 4));
            setTotalSurahs(data.length);
          }
        }
      } catch {
        // Fallback data is already set — no action needed
        console.warn("Using fallback Quran data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      {/* Surah list preview */}
      <div className="grid gap-2 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))
          : surahs.map((surah) => (
              <Link key={surah.surahNo} href={`/quran/${surah.surahNo}`}>
                <Card className="hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {formatLocalizedNumber(surah.surahNo, locale)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {showBengaliName
                            ? surah.nameBengali || surah.nameEnglish
                            : surah.nameEnglish}
                        </p>
                        <p className="text-sm font-arabic shrink-0" dir="rtl">
                          {surah.nameArabic}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {surah.nameTranslation} •{" "}
                        {t("quranAyahs", {
                          count: formatLocalizedNumber(surah.totalAyah, locale),
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      {/* Show total count & CTA */}
      {!loading && surahs.length > 0 && (
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("quranMoreSurahs", {
              count: formatLocalizedNumber(totalSurahs - surahs.length, locale),
            })}
          </p>
          <Button asChild>
            <Link href="/quran">
              <BookOpen className="h-4 w-4 mr-2" />
              {t("quranCTA")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
