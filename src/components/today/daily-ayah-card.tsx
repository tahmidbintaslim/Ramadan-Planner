"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { QuranIcon } from "@/components/icons/islamic-icons";
import { cn } from "@/lib/utils";

interface DailyAyah {
  day: number;
  ar: string;
  bn: string;
  en: string | null;
  ref: string;
}

/** The day's ayah from /api/daily-content (Ramadan days 1-30); null when it is missing or fails. */
function useDailyAyah(ramadanDay: number | null): DailyAyah | null {
  const [loaded, setLoaded] = useState<DailyAyah | null>(null);
  useEffect(() => {
    if (!ramadanDay) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/daily-content?day=${ramadanDay}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          data?: { day: number; ayahAr: string; ayahBn: string; ayahEn: string | null; ayahRef: string };
        };
        const d = json.ok ? json.data : undefined;
        // Only a complete, sourced ayah replaces the fallback.
        if (!cancelled && d?.ayahAr && d.ayahBn && d.ayahRef) {
          setLoaded({ day: d.day, ar: d.ayahAr, bn: d.ayahBn, en: d.ayahEn, ref: d.ayahRef });
        }
      } catch {
        // Offline or upstream error: the fallback ayah stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ramadanDay]);
  return loaded && loaded.day === ramadanDay ? loaded : null;
}

/**
 * The Home's one devotional card outside the sehri and iftar moments: the day's ayah with its reference
 * (Al-Fatihah 1:1 when the day's content is unavailable or outside Ramadan).
 */
export function DailyAyahCard({ ramadanDay, className }: { ramadanDay: number | null; className?: string }) {
  const t = useTranslations("today");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const loaded = useDailyAyah(ramadanDay);
  const ayah = loaded ?? {
    ar: t("fallbackAyahAr"),
    bn: t("fallbackAyahBn"),
    en: t("fallbackAyahEn"),
    ref: t("fallbackAyahRef"),
  };
  const meaning = locale === "en" ? ayah.en || ayah.bn : ayah.bn;

  return (
    <section
      aria-labelledby="home-ayah"
      data-testid="daily-ayah"
      className={cn("flex flex-col gap-2 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft", className)}
    >
      <h2 id="home-ayah" className="rp-row flex items-center gap-2 font-semibold">
        <QuranIcon size={24} className="text-rp-accent" />
        {tHome("ayahTitle")}
      </h2>
      <p lang="ar" dir="rtl" className="font-arabic text-[24px] leading-[48px]">
        {ayah.ar}
      </p>
      <p className="rp-reading-small text-rp-muted">{meaning}</p>
      <p className="rp-caption text-rp-gold-text">{ayah.ref}</p>
    </section>
  );
}
