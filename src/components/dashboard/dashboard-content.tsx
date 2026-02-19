"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Moon,
  Clock,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  Star,
} from "lucide-react";
import type { TimingData } from "@/types/database";
import type { RamadanStatus } from "@/lib/ramadan-date";
import { RamadanTimetable } from "@/components/landing/ramadan-timetable";
import { AnnouncementsStrip } from "@/components/shared/announcements-strip";
import { formatLocalizedNumber, localizeAsciiDigits } from "@/lib/locale-number";
import { getRamadanDayOrdinal } from "@/lib/ramadan-ordinal";

export function DashboardContent() {
  const t = useTranslations("dashboard");
  const tSalah = useTranslations("salah");
  const tQuran = useTranslations("quran");
  const tToday = useTranslations("today");
  const locale = useLocale();

  const [timings, setTimings] = useState<TimingData | null>(null);
  const [ramadan, setRamadan] = useState<RamadanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("--:--:--");

  // Fetch prayer times and Ramadan status
  useEffect(() => {
    async function load() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Try to get user's location for accurate prayer times
        let lat: number | undefined;
        let lng: number | undefined;

        try {
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
              }),
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // Geolocation denied or unavailable — use defaults
        }

        const timingsParams = new URLSearchParams({ tz });
        if (lat !== undefined) timingsParams.set("lat", String(lat));
        if (lng !== undefined) timingsParams.set("lng", String(lng));

        const [timingsRes, ramadanRes] = await Promise.all([
          fetch(`/api/timings?${timingsParams.toString()}`),
          fetch(`/api/ramadan?${timingsParams.toString()}`),
        ]);

        if (timingsRes.ok) {
          const data: TimingData = await timingsRes.json();
          setTimings(data);
        }
        if (ramadanRes.ok) {
          const data: RamadanStatus = await ramadanRes.json();
          setRamadan(data);
        }
      } catch {
        console.error("Failed to load dashboard data");
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

  const isRamadan = ramadan?.phase === "ramadan";
  const isPreRamadan = ramadan?.phase === "pre-ramadan";
  const ramadanDay = ramadan?.currentDay ?? null;
  const progress = 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header — adapts to Ramadan phase */}
      <div className="space-y-1">
        {loading ? (
          <>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </>
        ) : isRamadan ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("welcome")}
            </h1>
            <p className="text-muted-foreground">
              {t("ramadanDay", {
                day: getRamadanDayOrdinal(ramadanDay ?? 1, locale as "bn" | "en", "short"),
              })}
              {ramadan?.ramadanTotalDays && ramadanDay && (
                <span className="text-xs ml-2">
                  (
                  {t("daysOf30", {
                    day: formatLocalizedNumber(ramadanDay, locale),
                    total: formatLocalizedNumber(ramadan.ramadanTotalDays, locale),
                  })}
                  )
                </span>
              )}
            </p>
          </>
        ) : isPreRamadan ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("welcomePreRamadan")}
            </h1>
            <p className="text-muted-foreground">
              {ramadan?.daysUntil === 0
                ? t("ramadanCountdownToday")
                : ramadan?.daysUntil === 1
                  ? t("ramadanCountdownTomorrow")
                  : t("ramadanCountdown", {
                    days: formatLocalizedNumber(ramadan?.daysUntil ?? 0, locale),
                  })}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("welcomePreRamadan")}
            </h1>
            <p className="text-muted-foreground">{t("postRamadanDesc")}</p>
          </>
        )}

        {/* Hijri date display */}
        {ramadan && (
          <p className="text-xs text-muted-foreground">
            {t("currentHijriDate", {
              day: localizeAsciiDigits(String(ramadan.hijriDay), locale),
              month: ramadan.hijriMonthName,
              year: localizeAsciiDigits(String(ramadan.hijriYear), locale),
            })}
            {timings && ` • ${timings.location}`}
          </p>
        )}
      </div>

      <AnnouncementsStrip />

      {/* Pre-Ramadan countdown card */}
      {isPreRamadan && ramadan && (
        <Card className="bg-linear-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-lg">
                  {t("preRamadanTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("preRamadanDesc")}
                </p>
                {ramadan.ramadanStartGregorian && (
                  <p className="text-xs text-muted-foreground">
                    {t("ramadanStartDate", {
                      date: localizeAsciiDigits(ramadan.ramadanStartGregorian, locale),
                    })}
                    <span className="ml-2 italic">{t("moonSightingNote")}</span>
                  </p>
                )}
              </div>
              {ramadan.daysUntil !== null && ramadan.daysUntil > 0 && (
                <div className="shrink-0 text-center">
                  <p className="text-4xl font-bold text-primary">
                    {formatLocalizedNumber(ramadan.daysUntil, locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("daysLabel")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post-Ramadan card */}
      {ramadan?.phase === "post-ramadan" && (
        <Card className="bg-linear-to-r from-amber-50 to-amber-100/50 border-amber-200/50">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <Star className="h-10 w-10 text-amber-500" />
              <div>
                <h3 className="font-semibold text-lg">
                  {t("postRamadanTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("postRamadanDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  {timings
                    ? localizeAsciiDigits(timings.prayerTimes.sehri, locale)
                    : "--:--"}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("iftarTime")}</p>
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-lg font-semibold">
                  {timings
                    ? localizeAsciiDigits(timings.prayerTimes.iftar, locale)
                    : "--:--"}
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
                      {timings
                        ? localizeAsciiDigits(timings.prayerTimes[prayer], locale)
                        : "--:--"}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Iftar Countdown — only show during Ramadan or always (users may fast outside Ramadan too) */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm opacity-90">{t("iftarCountdown")}</p>
              <p className="text-3xl font-bold tracking-tight">
                {localizeAsciiDigits(countdown, locale)}
              </p>
            </div>
            <Moon className="h-10 w-10 opacity-80" />
          </div>
        </CardContent>
      </Card>

      {/* Ramadan Sehri & Iftar Timetable */}
      <RamadanTimetable compact />

      {/* Today's Progress — only meaningful during Ramadan */}
      {isRamadan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("todayProgress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {tSalah("fard")}
                </p>
                <p className="text-sm font-medium">
                  {`${formatLocalizedNumber(0, locale)}/${formatLocalizedNumber(5, locale)}`}
                </p>
              </div>
              <div className="space-y-1">
                <BookOpen className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {tQuran("page")}
                </p>
                <p className="text-sm font-medium">{formatLocalizedNumber(0, locale)}</p>
              </div>
              <div className="space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {tToday("checklist")}
                </p>
                <p className="text-sm font-medium">
                  {`${formatLocalizedNumber(0, locale)}/${formatLocalizedNumber(6, locale)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
