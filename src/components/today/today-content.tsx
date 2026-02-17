"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalahTracker } from "@/components/today/salah-tracker";
import { QuranTracker } from "@/components/today/quran-tracker";
import { DailyChecklist } from "@/components/today/daily-checklist";
import { JournalSection } from "@/components/today/journal-section";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Scroll, PenLine } from "lucide-react";

export function TodayContent() {
  const t = useTranslations("today");

  // TODO: Fetch from daily_content for current Ramadan day
  const dayContent = {
    day: 1,
    ayah_ar: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    ayah_bn: "পরম করুণাময় অতি দয়ালু আল্লাহর নামে",
    ayah_ref: "সূরা ফাতিহা ১:১",
    hadith_bn:
      "রাসূলুল্লাহ (সা.) বলেছেন: 'যে ব্যক্তি ঈমানের সাথে ও সওয়াবের আশায় রমজানের রোজা রাখে, তার পূর্ববর্তী সব গুনাহ মাফ করে দেওয়া হয়।'",
    hadith_ref: "বুখারী ও মুসলিম",
    dua_ar: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
    dua_bn:
      "হে আল্লাহ! তুমি ক্ষমাশীল, ক্ষমা করতে ভালোবাসো, তাই আমাকে ক্ষমা করো।",
    day_task_bn: "আজ একজন মানুষকে ইফতার করান",
  };

  return (
    <div className="space-y-6">
      {/* Day Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {useTranslations("dashboard")("ramadanDay", { day: dayContent.day })}
        </p>
      </div>

      {/* Ayah Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            {t("ayah")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-right text-xl leading-loose font-arabic" dir="rtl">
            {dayContent.ayah_ar}
          </p>
          <Separator />
          <p className="text-sm leading-relaxed">{dayContent.ayah_bn}</p>
          <p className="text-xs text-muted-foreground">{dayContent.ayah_ref}</p>
        </CardContent>
      </Card>

      {/* Hadith Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scroll className="h-4 w-4 text-primary" />
            {t("hadith")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed">{dayContent.hadith_bn}</p>
          <p className="text-xs text-muted-foreground">
            {dayContent.hadith_ref}
          </p>
        </CardContent>
      </Card>

      {/* Dua Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-4 w-4 text-primary" />
            {t("dua")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-right text-lg leading-loose font-arabic" dir="rtl">
            {dayContent.dua_ar}
          </p>
          <Separator />
          <p className="text-sm leading-relaxed">{dayContent.dua_bn}</p>
        </CardContent>
      </Card>

      {/* Day Task */}
      {dayContent.day_task_bn && (
        <Card className="border-primary/30 bg-accent/50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-primary">
              🎯 {t("dayTask")}: {dayContent.day_task_bn}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Salah Tracker */}
      <SalahTracker />

      {/* Quran Tracker */}
      <QuranTracker />

      {/* Daily Checklist */}
      <DailyChecklist />

      {/* Journal */}
      <JournalSection />
    </div>
  );
}
