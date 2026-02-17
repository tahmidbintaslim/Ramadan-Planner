"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Sunrise, Moon } from "lucide-react";
import type { TimingData } from "@/types/database";

export function PrayerTimesWidget() {
  const t = useTranslations("landing");
  const tSalah = useTranslations("salah");
  const tDash = useTranslations("dashboard");

  const [timings, setTimings] = useState<TimingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [countdown, setCountdown] = useState("--:--:--");

  // Fetch prayer times
  const fetchTimes = useCallback(
    async (lat?: number, lng?: number, tz?: string, label?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (lat !== undefined) params.set("lat", String(lat));
        if (lng !== undefined) params.set("lng", String(lng));
        if (tz) params.set("tz", tz);
        if (label) params.set("location", label);

        const res = await fetch(`/api/timings?${params.toString()}`);
        if (res.ok) {
          const data: TimingData = await res.json();
          setTimings(data);
          setLocationName(data.location);
        }
      } catch {
        console.error("Failed to load prayer times");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Auto-detect location or use Dhaka defaults
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          fetchTimes(pos.coords.latitude, pos.coords.longitude, tz);
        },
        () => {
          // Denied or unavailable — use defaults
          fetchTimes();
        },
        { timeout: 5000 },
      );
    } else {
      fetchTimes();
    }
  }, [fetchTimes]);

  // Iftar countdown
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

  const handleDetectLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          fetchTimes(pos.coords.latitude, pos.coords.longitude, tz);
        },
        () => {
          fetchTimes();
        },
      );
    }
  };

  const prayers = [
    { key: "fajr" as const, icon: Sunrise },
    { key: "dhuhr" as const, icon: Clock },
    { key: "asr" as const, icon: Clock },
    { key: "maghrib" as const, icon: Moon },
    { key: "isha" as const, icon: Moon },
  ];

  return (
    <div className="space-y-4">
      {/* Location bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span>
              {t("prayerTimesLocation")}: <strong>{locationName}</strong>
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleDetectLocation}>
          <MapPin className="h-3.5 w-3.5 mr-1.5" />
          {t("detectLocation")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Sehri & Iftar highlight */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="py-5">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-xs opacity-80">{t("sehri")}</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mx-auto bg-primary-foreground/20" />
                ) : (
                  <p className="text-2xl font-bold">
                    {timings?.prayerTimes.sehri ?? "--:--"}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs opacity-80">{t("iftar")}</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mx-auto bg-primary-foreground/20" />
                ) : (
                  <p className="text-2xl font-bold">
                    {timings?.prayerTimes.iftar ?? "--:--"}
                  </p>
                )}
              </div>
            </div>
            {/* Iftar countdown */}
            <div className="mt-4 text-center border-t border-primary-foreground/20 pt-3">
              <p className="text-xs opacity-80">{tDash("iftarCountdown")}</p>
              <p className="text-xl font-bold tracking-wider">{countdown}</p>
            </div>
          </CardContent>
        </Card>

        {/* 5 Waqt Prayer Times */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {tDash("prayerTimes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {prayers.map(({ key, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{tSalah(key)}</span>
                  </div>
                  {loading ? (
                    <Skeleton className="h-4 w-14" />
                  ) : (
                    <span className="font-medium tabular-nums">
                      {timings?.prayerTimes[key] ?? "--:--"}
                    </span>
                  )}
                </div>
              ))}
              {/* Sunrise */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Sunrise className="h-3.5 w-3.5" />
                  <span>{t("sunrise")}</span>
                </div>
                {loading ? (
                  <Skeleton className="h-4 w-14" />
                ) : (
                  <span className="font-medium tabular-nums">
                    {timings?.prayerTimes.sunrise ?? "--:--"}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hijri date */}
      {timings && (
        <p className="text-center text-xs text-muted-foreground">
          {timings.hijriDate.day} {timings.hijriDate.monthBn}{" "}
          {timings.hijriDate.year} • {timings.gregorianDate}
        </p>
      )}
    </div>
  );
}
