"use client";

import { useLocale, useTranslations } from "@/i18n/use-intl";
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, CrescentIcon, LanternIcon, MosqueIcon } from "@/components/icons/islamic-icons";
import { formatClock, type Locale } from "@/components/timetable/timetable-logic";
import { hijriMonthLabel } from "@/lib/hijri-months";
import type { TimingData } from "@/types/database";
import type { RamadanStatus } from "@/lib/ramadan-date";
import { RamadanTimetable } from "@/components/landing/ramadan-timetable";
import { AnnouncementsStrip } from "@/components/shared/announcements-strip";
import { DailyIbadahTracker } from "@/components/shared/daily-ibadah-tracker";
import {
  formatLocalizedNumber,
  localizeAsciiDigits,
} from "@/lib/locale-number";
import { getRamadanDayOrdinal } from "@/lib/ramadan-ordinal";
import { rememberTimings } from "@/lib/auto-night";
import { storedRequestLocation } from "@/lib/user-location";
import { localTodayISO } from "@/lib/local-day";

export function DashboardContent() {
  const t = useTranslations("dashboard");
  const tSalah = useTranslations("salah");
  const locale = useLocale();

  const [timings, setTimings] = useState<TimingData | null>(null);
  const [ramadan, setRamadan] = useState<RamadanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("--:--:--");

  // Fetch prayer times and Ramadan status
  useEffect(() => {
    async function load() {
      try {
        // The location chosen at onboarding wins (no geolocation prompt); otherwise the device position.
        const stored = storedRequestLocation();
        const tz = stored?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Try to get user's location for accurate prayer times
        let lat: number | undefined = stored?.lat;
        let lng: number | undefined = stored?.lng;

        if (!stored) try {
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

        // The local date keys the CDN cache, so a request after local midnight never gets yesterday's entry.
        const timingsParams = new URLSearchParams({ tz, date: localTodayISO(new Date(), tz) });
        if (lat !== undefined) timingsParams.set("lat", lat.toFixed(2));
        if (lng !== undefined) timingsParams.set("lng", lng.toFixed(2));

        const [timingsRes, ramadanRes] = await Promise.all([
          fetch(`/api/timings?${timingsParams.toString()}`),
          fetch(`/api/ramadan?${timingsParams.toString()}`),
        ]);

        if (timingsRes.ok) {
          const data: TimingData = await timingsRes.json();
          setTimings(data);
          // Auto Night mode reads the last known timings (location-based ones win over timezone defaults).
          rememberTimings(data, lat !== undefined ? "geo" : "tz");
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

  const clock = (hhmm: string | undefined) => (hhmm ? formatClock(hhmm, locale as Locale) : "--:--");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Welcome header, by Ramadan phase */}
      <div className="space-y-1">
        {loading ? (
          <>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-64" />
          </>
        ) : (
          <>
            <h1 className="rp-h1 text-rp-ink">{isRamadan ? t("welcome") : t("welcomePreRamadan")}</h1>
            <p className="rp-body text-rp-muted">
              {isRamadan ? (
                <>
                  {t("ramadanDay", { day: getRamadanDayOrdinal(ramadanDay ?? 1, locale as "bn" | "en", "short") })}
                  {ramadan?.ramadanTotalDays && ramadanDay ? (
                    <span className="rp-small ms-2">
                      (
                      {t("daysOf30", {
                        day: formatLocalizedNumber(ramadanDay, locale),
                        total: formatLocalizedNumber(ramadan.ramadanTotalDays, locale),
                      })}
                      )
                    </span>
                  ) : null}
                </>
              ) : isPreRamadan ? (
                ramadan?.daysUntil === 0 ? (
                  t("ramadanCountdownToday")
                ) : ramadan?.daysUntil === 1 ? (
                  t("ramadanCountdownTomorrow")
                ) : (
                  t("ramadanCountdown", { days: formatLocalizedNumber(ramadan?.daysUntil ?? 0, locale) })
                )
              ) : (
                t("postRamadanDesc")
              )}
            </p>
          </>
        )}

        {/* Hijri date */}
        {ramadan && (
          <p className="rp-small text-rp-muted">
            {t("currentHijriDate", {
              day: localizeAsciiDigits(String(ramadan.hijriDay), locale),
              month: hijriMonthLabel(ramadan.hijriMonth, ramadan.hijriMonthName, locale),
              year: localizeAsciiDigits(String(ramadan.hijriYear), locale),
            })}
            {timings && ` • ${timings.location}`}
          </p>
        )}
      </div>

      <AnnouncementsStrip />

      {/* Pre-Ramadan countdown card */}
      {isPreRamadan && ramadan && (
        <Card className="flex-row items-center gap-4 bg-linear-to-br from-rp-accent-tint to-rp-surface px-5">
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-rp-full bg-rp-surface text-rp-accent">
            <CalendarIcon size={28} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="rp-h2 text-rp-ink">{t("preRamadanTitle")}</h2>
            <p className="rp-small text-rp-muted">{t("preRamadanDesc")}</p>
            {ramadan.ramadanStartGregorian && (
              <p className="rp-caption text-rp-muted">
                {t("ramadanStartDate", { date: localizeAsciiDigits(ramadan.ramadanStartGregorian, locale) })}
                <span className="ms-2">{t("moonSightingNote")}</span>
              </p>
            )}
          </div>
          {ramadan.daysUntil !== null && ramadan.daysUntil > 0 && (
            <div className="shrink-0 text-center">
              <p className="rp-time-l text-rp-accent">{formatLocalizedNumber(ramadan.daysUntil, locale)}</p>
              <p className="rp-caption text-rp-muted">{t("daysLabel")}</p>
            </div>
          )}
        </Card>
      )}

      {/* Post-Ramadan card */}
      {ramadan?.phase === "post-ramadan" && (
        <Card className="flex-row items-center gap-4 bg-rp-gold-tint px-5">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-rp-full bg-rp-surface text-rp-gold-text">
            <LanternIcon size={24} />
          </span>
          <div>
            <h2 className="rp-h2 text-rp-ink">{t("postRamadanTitle")}</h2>
            <p className="rp-small text-rp-muted">{t("postRamadanDesc")}</p>
          </div>
        </Card>
      )}

      {/* Prayer times */}
      <Card className="gap-3 px-5">
        <h2 className="rp-h2 flex items-center gap-2 text-rp-ink">
          <MosqueIcon size={24} className="text-rp-accent" />
          {t("prayerTimes")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {(["sehri", "iftar"] as const).map((key) => (
            <div key={key} className="rounded-rp-md bg-rp-accent-tint p-4">
              <p className="rp-caption text-rp-muted">{t(key === "sehri" ? "sehriTime" : "iftarTime")}</p>
              {loading ? (
                <Skeleton className="mt-1 h-8 w-20" />
              ) : (
                <p className="rp-h2 tabular-nums text-rp-ink">{clock(timings?.prayerTimes[key])}</p>
              )}
            </div>
          ))}
        </div>
        <ul className="divide-y divide-rp-rule">
          {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((prayer) => (
            <li key={prayer} className="flex min-h-12 items-center justify-between gap-3">
              <span className="rp-row text-rp-ink">{tSalah(prayer)}</span>
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="rp-row tabular-nums text-rp-ink">{clock(timings?.prayerTimes[prayer])}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Iftar countdown */}
      <Card className="flex-row items-center justify-between bg-rp-live px-5 text-rp-on-live">
        <div className="space-y-1 text-rp-on-live">
          <p className="rp-small">{t("iftarCountdown")}</p>
          <p className="rp-time-l tabular-nums">{localizeAsciiDigits(countdown, locale)}</p>
        </div>
        <CrescentIcon size={40} aria-hidden="true" className="text-rp-on-live" />
      </Card>

      {/* Ramadan sehri and iftar timetable */}
      <RamadanTimetable compact />

      {/* Daily ibadah tracker, only during Ramadan */}
      {isRamadan && <DailyIbadahTracker day={ramadanDay ?? 1} />}
    </div>
  );
}
