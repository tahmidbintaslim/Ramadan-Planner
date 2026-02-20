"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SalahTracker } from "@/components/today/salah-tracker";
import { QuranTracker } from "@/components/today/quran-tracker";
import { DailyChecklist } from "@/components/today/daily-checklist";
import { JournalSection } from "@/components/today/journal-section";
import { Separator } from "@/components/ui/separator";
import { DailyIbadahTracker } from "@/components/shared/daily-ibadah-tracker";
import { BookOpen, Pause, PenLine, Play, Scroll, Square, Volume2, VolumeX } from "lucide-react";
import { getRamadanDayOrdinal } from "@/lib/ramadan-ordinal";
import { useAuth } from "@/components/providers/auth-provider";
import { getDailyLogAction, saveDailyLogAction } from "@/actions/planner";
import { DAILY_TRACKER_MARKERS } from "@/lib/daily-tracker-markers";
import { getTodayKey, useGuestData } from "@/hooks/use-guest-data";

type RecitationTarget = "ayah" | "dua" | null;

export function TodayContent() {
  const t = useTranslations("today");
  const tDashboard = useTranslations("dashboard");
  const tQuranReader = useTranslations("quranReader");
  const locale = useLocale();
  const { isGuest, loading: authLoading } = useAuth();
  const [ramadanDay, setRamadanDay] = useState<number | null>(null);
  const [loadedContent, setLoadedContent] = useState<{
    day: number;
    ayah_ar: string;
    ayah_bn: string;
    ayah_en: string | null;
    ayah_ref: string;
    hadith_bn: string;
    hadith_en: string | null;
    hadith_ref: string;
    dua_ar: string;
    dua_bn: string;
    dua_en: string | null;
    day_task_bn: string | null;
    day_task_en: string | null;
  } | null>(null);
  const [isReciting, setIsReciting] = useState(false);
  const [isRecitationPaused, setIsRecitationPaused] = useState(false);
  const [isRecitationMuted, setIsRecitationMuted] = useState(false);
  const [recitationTarget, setRecitationTarget] =
    useState<RecitationTarget>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ayahCardRef = useRef<HTMLDivElement | null>(null);
  const hadithCardRef = useRef<HTMLDivElement | null>(null);
  const autoMarkedRef = useRef<{ quranRead: boolean; hadithRead: boolean }>({
    quranRead: false,
    hadithRead: false,
  });
  const {
    updateData: updateGuestTracker,
  } = useGuestData<{
    quranRead: boolean;
    hadithRead: boolean;
  }>(getTodayKey("daily_ibadah_tracker"), {
    quranRead: false,
    hadithRead: false,
  });
  const trackingDay = loadedContent?.day ?? ramadanDay ?? 1;

  useEffect(() => {
    const loadRamadanDay = async () => {
      const getCurrentRamadanDay = async (
        params: URLSearchParams,
      ): Promise<number | null> => {
        const res = await fetch(`/api/ramadan?${params.toString()}`);
        if (!res.ok) return null;

        const data = (await res.json()) as { phase?: string; currentDay?: number };
        if (
          data.phase === "ramadan" &&
          typeof data.currentDay === "number" &&
          data.currentDay >= 1 &&
          data.currentDay <= 30
        ) {
          return data.currentDay;
        }

        return null;
      };

      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const baseParams = new URLSearchParams({ tz });
        const dayFromTimezone = await getCurrentRamadanDay(baseParams);
        if (dayFromTimezone) {
          setRamadanDay(dayFromTimezone);
        }

        if ("geolocation" in navigator) {
          try {
            const pos = await new Promise<GeolocationPosition>(
              (resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 5000,
                }),
            );
            const geoParams = new URLSearchParams({ tz });
            geoParams.set("lat", String(pos.coords.latitude));
            geoParams.set("lng", String(pos.coords.longitude));
            const dayFromGeo = await getCurrentRamadanDay(geoParams);
            if (dayFromGeo) {
              setRamadanDay(dayFromGeo);
            }
          } catch {
            // Keep timezone-only fallback
          }
        }
      } catch {
        // Keep fallback day
      }
    };

    loadRamadanDay();
  }, []);

  const fallbackContent = {
    day: ramadanDay ?? 1,
    ayah_ar: t("fallbackAyahAr"),
    ayah_bn: t("fallbackAyahBn"),
    ayah_en: t("fallbackAyahEn"),
    ayah_ref: t("fallbackAyahRef"),
    hadith_bn: t("fallbackHadithBn"),
    hadith_en: t("fallbackHadithEn"),
    hadith_ref: t("fallbackHadithRef"),
    dua_ar: t("fallbackDuaAr"),
    dua_bn: t("fallbackDuaBn"),
    dua_en: t("fallbackDuaEn"),
    day_task_bn: t("fallbackDayTaskBn"),
    day_task_en: t("fallbackDayTaskEn"),
  };

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const cancelRecitation = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, []);

  const stopRecitation = useCallback(() => {
    cancelRecitation();
    setIsReciting(false);
    setIsRecitationPaused(false);
    setRecitationTarget(null);
  }, [cancelRecitation]);

  const speakText = useCallback(
    (target: Exclude<RecitationTarget, null>, textArabic: string) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        !textArabic.trim()
      ) {
        return;
      }

      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setRecitationTarget(target);

      const utterance = new SpeechSynthesisUtterance(textArabic);
      utterance.lang = "ar-SA";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = isRecitationMuted ? 0 : 1;

      utterance.onstart = () => {
        setIsReciting(true);
        setIsRecitationPaused(false);
      };
      utterance.onend = () => {
        setIsReciting(false);
        setIsRecitationPaused(false);
        setRecitationTarget(null);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setIsReciting(false);
        setIsRecitationPaused(false);
        setRecitationTarget(null);
        utteranceRef.current = null;
      };
      utterance.onpause = () => {
        setIsReciting(false);
        setIsRecitationPaused(true);
      };
      utterance.onresume = () => {
        setIsReciting(true);
        setIsRecitationPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isRecitationMuted],
  );

  const pauseRecitation = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
  }, []);

  const resumeRecitation = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
  }, []);

  const toggleRecitationMute = useCallback(() => {
    setIsRecitationMuted((prev) => {
      const next = !prev;
      if (utteranceRef.current) {
        utteranceRef.current.volume = next ? 0 : 1;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      cancelRecitation();
    };
  }, [cancelRecitation]);

  useEffect(() => {
    const loadDailyContent = async () => {
      if (!ramadanDay) {
        setLoadedContent(null);
        return;
      }

      try {
        const res = await fetch(`/api/daily-content?day=${ramadanDay}`);
        if (!res.ok) {
          setLoadedContent(null);
          return;
        }

        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            day: number;
            ayahAr: string;
            ayahBn: string;
            ayahEn: string | null;
            ayahRef: string;
            hadithBn: string;
            hadithEn: string | null;
            hadithRef: string;
            duaAr: string;
            duaBn: string;
            duaEn: string | null;
            dayTaskBn: string | null;
            dayTaskEn: string | null;
          };
        };

        if (!json.ok || !json.data) {
          setLoadedContent(null);
          return;
        }

        setLoadedContent({
          day: json.data.day,
          ayah_ar: json.data.ayahAr,
          ayah_bn: json.data.ayahBn,
          ayah_en: json.data.ayahEn,
          ayah_ref: json.data.ayahRef,
          hadith_bn: json.data.hadithBn,
          hadith_en: json.data.hadithEn,
          hadith_ref: json.data.hadithRef,
          dua_ar: json.data.duaAr,
          dua_bn: json.data.duaBn,
          dua_en: json.data.duaEn,
          day_task_bn: json.data.dayTaskBn,
          day_task_en: json.data.dayTaskEn,
        });
      } catch {
        setLoadedContent(null);
      }
    };

    loadDailyContent();
  }, [ramadanDay]);

  useEffect(() => {
    autoMarkedRef.current = { quranRead: false, hadithRead: false };
  }, [trackingDay]);

  const markAutoTracker = useCallback(
    async (type: "quranRead" | "hadithRead") => {
      if (authLoading || autoMarkedRef.current[type]) return;
      autoMarkedRef.current[type] = true;

      if (isGuest) {
        updateGuestTracker((prev) =>
          prev[type] ? prev : { ...prev, [type]: true },
        );
        return;
      }

      const marker =
        type === "quranRead"
          ? DAILY_TRACKER_MARKERS.quran
          : DAILY_TRACKER_MARKERS.hadith;

      const res = await getDailyLogAction(trackingDay);
      if (!res.ok) return;

      const baseChecklist = res.data?.checklist ?? [];
      if (baseChecklist.includes(marker)) return;

      await saveDailyLogAction({
        day: trackingDay,
        checklist: [...baseChecklist, marker],
      });
    },
    [authLoading, isGuest, trackingDay, updateGuestTracker],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observers: IntersectionObserver[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const register = (
      node: HTMLElement | null,
      onRead: () => void,
    ) => {
      if (!node) return;

      let timer: ReturnType<typeof setTimeout> | null = null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            timer = setTimeout(onRead, 6000);
            timers.push(timer);
          } else if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        },
        { threshold: [0.6] },
      );
      observer.observe(node);
      observers.push(observer);
    };

    register(ayahCardRef.current, () => {
      void markAutoTracker("quranRead");
    });
    register(hadithCardRef.current, () => {
      void markAutoTracker("hadithRead");
    });

    return () => {
      observers.forEach((o) => o.disconnect());
      timers.forEach((t) => clearTimeout(t));
    };
  }, [markAutoTracker]);

  const dayContent = loadedContent ?? fallbackContent;
  const resolvedDay = loadedContent?.day ?? ramadanDay;
  const showEnglish = locale === "en";
  const isAyahPlaying = recitationTarget === "ayah" && isReciting;
  const isAyahPaused = recitationTarget === "ayah" && isRecitationPaused;
  const isDuaPlaying = recitationTarget === "dua" && isReciting;
  const isDuaPaused = recitationTarget === "dua" && isRecitationPaused;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {resolvedDay
            ? tDashboard("ramadanDay", {
                day: getRamadanDayOrdinal(resolvedDay, locale as "bn" | "en", "short"),
              })
            : "Ramadan Day --"}
        </p>
      </div>

      <DailyIbadahTracker day={trackingDay} />

      <div ref={ayahCardRef}>
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
          {speechSupported && (
            <div className="flex items-center gap-2 flex-wrap">
              {!isAyahPlaying && !isAyahPaused ? (
                <Button
                  size="sm"
                  onClick={() => {
                    void markAutoTracker("quranRead");
                    speakText("ayah", dayContent.ayah_ar);
                  }}
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  {tQuranReader("listenRecitation")}
                </Button>
              ) : isAyahPaused ? (
                <>
                  <Button size="sm" onClick={resumeRecitation}>
                    <Play className="h-4 w-4 mr-1.5" />
                    {tQuranReader("resume")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={stopRecitation}>
                    <Square className="h-4 w-4 mr-1.5" />
                    {tQuranReader("stopAudio")}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={pauseRecitation}>
                    <Pause className="h-4 w-4 mr-1.5" />
                    {tQuranReader("pause")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={stopRecitation}>
                    <Square className="h-4 w-4 mr-1.5" />
                    {tQuranReader("stopAudio")}
                  </Button>
                </>
              )}

              <Button size="sm" variant="outline" onClick={toggleRecitationMute}>
                {isRecitationMuted ? (
                  <VolumeX className="h-4 w-4 mr-1.5" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-1.5" />
                )}
                {isRecitationMuted
                  ? tQuranReader("unmute")
                  : tQuranReader("mute")}
              </Button>
            </div>
          )}
          <p className="text-sm leading-relaxed">
            {showEnglish
              ? dayContent.ayah_en || dayContent.ayah_bn
              : dayContent.ayah_bn}
          </p>
          <p className="text-xs text-muted-foreground">{dayContent.ayah_ref}</p>
        </CardContent>
        </Card>
      </div>

      <div ref={hadithCardRef}>
        <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scroll className="h-4 w-4 text-primary" />
            {t("hadith")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed">
            {showEnglish
              ? dayContent.hadith_en || dayContent.hadith_bn
              : dayContent.hadith_bn}
          </p>
          <p className="text-xs text-muted-foreground">{dayContent.hadith_ref}</p>
        </CardContent>
        </Card>
      </div>

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
          {speechSupported && (
            <div className="flex items-center gap-2 flex-wrap">
              {!isDuaPlaying && !isDuaPaused ? (
                <Button
                  size="sm"
                  onClick={() => speakText("dua", dayContent.dua_ar)}
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  {tQuranReader("listenRecitation")}
                </Button>
              ) : isDuaPaused ? (
                <>
                  <Button size="sm" onClick={resumeRecitation}>
                    <Play className="h-4 w-4 mr-1.5" />
                    {tQuranReader("resume")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={stopRecitation}>
                    <Square className="h-4 w-4 mr-1.5" />
                    {tQuranReader("stopAudio")}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={pauseRecitation}>
                    <Pause className="h-4 w-4 mr-1.5" />
                    {tQuranReader("pause")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={stopRecitation}>
                    <Square className="h-4 w-4 mr-1.5" />
                    {tQuranReader("stopAudio")}
                  </Button>
                </>
              )}

              <Button size="sm" variant="outline" onClick={toggleRecitationMute}>
                {isRecitationMuted ? (
                  <VolumeX className="h-4 w-4 mr-1.5" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-1.5" />
                )}
                {isRecitationMuted
                  ? tQuranReader("unmute")
                  : tQuranReader("mute")}
              </Button>
            </div>
          )}
          <p className="text-sm leading-relaxed">
            {showEnglish
              ? dayContent.dua_en || dayContent.dua_bn
              : dayContent.dua_bn}
          </p>
        </CardContent>
      </Card>

      {(showEnglish ? dayContent.day_task_en : dayContent.day_task_bn) && (
        <Card className="border-primary/30 bg-accent/50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-primary">
              🎯 {t("dayTask")}:{" "}
              {showEnglish
                ? dayContent.day_task_en || dayContent.day_task_bn
                : dayContent.day_task_bn}
            </p>
          </CardContent>
        </Card>
      )}

      <SalahTracker day={trackingDay} />
      <QuranTracker day={trackingDay} />
      <DailyChecklist day={trackingDay} />
      <JournalSection day={trackingDay} />
    </div>
  );
}
