"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, CalendarDays } from "lucide-react";
import type {
  RamadanTimetable as TimetableType,
  TimetableDay,
} from "@/lib/ramadan-timetable";
import { getRamadanDayOrdinal } from "@/lib/ramadan-ordinal";
import { localizeAsciiDigits } from "@/lib/locale-number";

interface RamadanTimetableProps {
  /** Compact mode shows fewer columns, used in dashboard */
  compact?: boolean;
}

export function RamadanTimetable({ compact = false }: RamadanTimetableProps) {
  const t = useTranslations("landing");
  const tNav = useTranslations("nav");
  const locale = useLocale() as "bn" | "en";

  const [timetable, setTimetable] = useState<TimetableType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [locationName, setLocationName] = useState("");

  const fetchTimetable = useCallback(
    async (lat?: number, lng?: number, tz?: string) => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams();
        if (lat !== undefined) params.set("lat", String(lat));
        if (lng !== undefined) params.set("lng", String(lng));
        if (tz) params.set("tz", tz);

        const res = await fetch(`/api/ramadan-timetable?${params.toString()}`);
        if (res.ok) {
          const data: TimetableType = await res.json();
          setTimetable(data);
          setLocationName(data.location);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const detectLocationAndFetch = useCallback(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchTimetable(pos.coords.latitude, pos.coords.longitude, tz);
        },
        () => {
          // Fallback to timezone-based defaults even if geolocation fails
          fetchTimetable(undefined, undefined, tz);
        },
        { timeout: 5000 },
      );
      return;
    }

    fetchTimetable(undefined, undefined, tz);
  }, [fetchTimetable]);

  // Auto-detect location
  useEffect(() => {
    detectLocationAndFetch();
  }, [detectLocationAndFetch]);

  // Get today's gregorian date in DD-MM-YYYY format for highlighting
  const todayStr = (() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  })();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !timetable) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{t("timetableError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={detectLocationAndFetch}
          >
            {t("detectLocation")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t("timetableTitle")}
        </CardTitle>
        <div className="flex items-center justify-between flex-wrap gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>
              {t("timetableLocation")}:{" "}
              <strong className="text-foreground">{locationName}</strong>
            </span>
          </div>
          <span className="text-xs">{t("timetableMethod")}</span>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  {t("timetableDay")}
                </TableHead>
                {!compact && <TableHead>{t("timetableDate")}</TableHead>}
                <TableHead className="text-center">
                  {t("timetableSehri")}
                </TableHead>
                {!compact && (
                  <TableHead className="text-center">
                    {t("timetableFajr")}
                  </TableHead>
                )}
                <TableHead className="text-center">
                  {t("timetableIftar")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timetable.days.map((day: TimetableDay) => {
                const isToday = day.gregorianDate === todayStr;
                const dayOrdinal = getRamadanDayOrdinal(
                  day.day,
                  locale,
                  "short",
                );
                return (
                  <TableRow
                    key={day.day}
                    className={
                      isToday
                        ? "bg-primary/10 font-semibold border-l-2 border-l-primary"
                        : ""
                    }
                  >
                    <TableCell className="text-center font-medium">
                      {dayOrdinal}
                      {isToday && (
                        <span className="ml-1 text-[10px] text-primary font-bold align-super">
                          {t("timetableToday")}
                        </span>
                      )}
                    </TableCell>
                    {!compact && (
                      <TableCell className="text-xs text-muted-foreground">
                        {tNav(`weekdays.${day.weekday}` as "weekdays.Mon" | "weekdays.Tue" | "weekdays.Wed" | "weekdays.Thu" | "weekdays.Fri" | "weekdays.Sat" | "weekdays.Sun")}, {localizeAsciiDigits(day.gregorianDate, locale)}
                      </TableCell>
                    )}
                    <TableCell className="text-center tabular-nums">
                      {localizeAsciiDigits(day.sehri, locale)}
                    </TableCell>
                    {!compact && (
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {localizeAsciiDigits(day.fajr, locale)}
                      </TableCell>
                    )}
                    <TableCell className="text-center tabular-nums">
                      {localizeAsciiDigits(day.iftar, locale)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
