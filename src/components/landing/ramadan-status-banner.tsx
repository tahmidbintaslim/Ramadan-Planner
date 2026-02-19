"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Moon, Star } from "lucide-react";
import type { RamadanStatus } from "@/lib/ramadan-date";
import {
  formatLocalizedNumber,
  localizeAsciiDigits,
} from "@/lib/locale-number";

export function RamadanStatusBanner() {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  const [status, setStatus] = useState<RamadanStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const params = new URLSearchParams({ tz });

        if ("geolocation" in navigator) {
          try {
            const pos = await new Promise<GeolocationPosition>(
              (resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 5000,
                }),
            );
            params.set("lat", String(pos.coords.latitude));
            params.set("lng", String(pos.coords.longitude));
          } catch {
            // Continue with timezone-only fallback
          }
        }

        const res = await fetch(`/api/ramadan?${params.toString()}`);
        if (res.ok) {
          const data: RamadanStatus = await res.json();
          setStatus(data);
        }
      } catch {
        // Silently fail — banner is supplementary
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !status) return null;

  if (status.phase === "ramadan") {
    return (
      <Card className="bg-primary text-primary-foreground border-0 rounded-lg mx-3 sm:mx-0">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-center gap-3">
            <Moon className="h-6 w-6 opacity-80 shrink-0" />
            <div className="flex flex-col items-start">
              <p className="font-bold text-base sm:text-lg">{t("welcome")}</p>
              <p className="text-sm sm:text-sm opacity-90">
                {t("ramadanDay", {
                  day: formatLocalizedNumber(status.currentDay ?? 1, locale),
                })}
                {" • "}
                {t("currentHijriDate", {
                  day: localizeAsciiDigits(String(status.hijriDay), locale),
                  month: status.hijriMonthName,
                  year: localizeAsciiDigits(String(status.hijriYear), locale),
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status.phase === "pre-ramadan") {
    return (
      <Card className="bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 rounded-lg mx-3 sm:mx-0">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {status.daysUntil === 0
                    ? t("ramadanCountdownToday")
                    : status.daysUntil === 1
                      ? t("ramadanCountdownTomorrow")
                      : t("ramadanCountdown", {
                          days: formatLocalizedNumber(
                            status.daysUntil ?? 0,
                            locale,
                          ),
                        })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("currentHijriDate", {
                    day: localizeAsciiDigits(String(status.hijriDay), locale),
                    month: status.hijriMonthName,
                    year: localizeAsciiDigits(String(status.hijriYear), locale),
                  })}
                  {status.ramadanStartGregorian && (
                    <span>
                      {" • "}
                      {t("ramadanStartDate", {
                        date: localizeAsciiDigits(
                          status.ramadanStartGregorian,
                          locale,
                        ),
                      })}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  {t("moonSightingNote")}
                </p>
              </div>
            </div>
            {status.daysUntil !== null && status.daysUntil > 0 && (
              <div className="text-center shrink-0">
                <p className="text-2xl sm:text-3xl font-bold text-primary">
                  {formatLocalizedNumber(status.daysUntil, locale)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("daysLabel")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Post-Ramadan
  return (
    <Card className="bg-linear-to-r from-amber-50 to-amber-100/50 border-amber-200/50 rounded-lg mx-3 sm:mx-0">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-center gap-3 ">
          <Star className="h-6 w-6 text-amber-500 shrink-0" />
          <div className="flex">
            <p className="font-semibold">{t("postRamadanTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("postRamadanDesc")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
