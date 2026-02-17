"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, Clock, BookOpen, CheckCircle2 } from "lucide-react";
import type { TimingData } from "@/types/database";

export function DashboardContent() {
  const t = useTranslations("dashboard");
  const tSalah = useTranslations("salah");
  const tQuran = useTranslations("quran");
  const tToday = useTranslations("today");

  const [timings, setTimings] = useState<TimingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("--:--:--");

  // Fetch prayer times from API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/timings");
        if (res.ok) {
          const data: TimingData = await res.json();
          setTimings(data);
        }
      } catch {
        console.error("Failed to load prayer times");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Iftar countdown timer
  const updateCountdown = useCallback(() => {
    if (!timings) return;
    const [hh, mm] = timings.prayerTimes.iftar.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", {
      timeZone: timings.timezone,
    });
    const iftarDate = new Date(
      `${todayStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
    );
    const diffMs = iftarDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      setCountdown("00:00:00");
      return;
    }

    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    setCountdown(
      `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    );
  }, [timings]);

  useEffect(() => {
    if (!timings) return;
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [timings, updateCountdown]);

  // TODO: Replace with real data from Supabase
  const ramadanDay = 1;
  const progress = 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("welcome")}</h1>
        <p className="text-muted-foreground">
          {t("ramadanDay", { day: ramadanDay })}
        </p>
        {timings && (
          <p className="text-xs text-muted-foreground">
            {timings.hijriDate.day} {timings.hijriDate.monthBn}{" "}
            {timings.hijriDate.year} • {timings.location}
          </p>
        )}
      </div>

      {/* Prayer Times Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            {t("prayerTimes")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("sehriTime")}</p>
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-lg font-semibold">
                  {timings?.prayerTimes.sehri ?? "--:--"}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("iftarTime")}</p>
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-lg font-semibold">
                  {timings?.prayerTimes.iftar ?? "--:--"}
                </p>
              )}
            </div>
            {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map(
              (prayer) => (
                <div key={prayer} className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {tSalah(prayer)}
                  </p>
                  {loading ? (
                    <Skeleton className="h-5 w-16" />
                  ) : (
                    <p className="text-sm font-medium">
                      {timings?.prayerTimes[prayer] ?? "--:--"}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Iftar Countdown */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm opacity-90">{t("iftarCountdown")}</p>
              <p className="text-3xl font-bold tracking-tight">{countdown}</p>
            </div>
            <Moon className="h-10 w-10 opacity-80" />
          </div>
        </CardContent>
      </Card>

      {/* Today's Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("todayProgress")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <CheckCircle2 className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{tSalah("fard")}</p>
              <p className="text-sm font-medium">0/5</p>
            </div>
            <div className="space-y-1">
              <BookOpen className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{tQuran("page")}</p>
              <p className="text-sm font-medium">0</p>
            </div>
            <div className="space-y-1">
              <CheckCircle2 className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {tToday("checklist")}
              </p>
              <p className="text-sm font-medium">0/6</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
