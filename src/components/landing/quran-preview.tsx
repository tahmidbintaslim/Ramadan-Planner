"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SurahInfo } from "@/lib/quran";

export function QuranPreview() {
  const t = useTranslations("landing");

  const [surahs, setSurahs] = useState<SurahInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/quran");
        if (res.ok) {
          const data: SurahInfo[] = await res.json();
          setSurahs(data);
        }
      } catch {
        console.error("Failed to load Quran data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Show first 10 surahs as preview
  const previewSurahs = surahs.slice(0, 10);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        {t("quranDesc")}
      </p>

      {/* Surah list preview */}
      <div className="grid gap-2 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))
          : previewSurahs.map((surah) => (
              <Card
                key={surah.number}
                className="hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {surah.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {surah.englishName}
                      </p>
                      <p className="text-sm font-arabic shrink-0" dir="rtl">
                        {surah.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {surah.englishNameTranslation} • {surah.numberOfAyahs}{" "}
                      Ayahs
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Show total count & CTA */}
      {!loading && surahs.length > 0 && (
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            + {surahs.length - 10} more Surahs
          </p>
          <Button asChild>
            <Link href="/today">
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
