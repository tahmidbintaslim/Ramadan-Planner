"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCalcSource } from "@/components/prayer/use-calc-source";
import { toast } from "sonner";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareIcon } from "@/components/icons/islamic-icons";
import { Printer } from "lucide-react";
import { oddNightStartingAfter } from "@/lib/ramadan-nights";
import { todayISOInZone } from "@/lib/prayer-phase";
import { calcRequestParams, readStoredLocation, storedRequestLocation } from "@/lib/user-location";
import { districtById, districtName } from "@/lib/districts";
import type { RamadanTimetable, TimetableDay } from "@/lib/ramadan-timetable";
import { TimetableRow } from "./timetable-row";
import {
  DECADES,
  type Locale,
  coarse,
  dateRange,
  decadeDays,
  defaultDecade,
  digits,
  formatRange,
  isRamadanNow,
  rowState,
} from "./timetable-logic";

type WeekdayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const DHAKA_TIME_ZONE = "Asia/Dhaka";

async function loadTimetable(tz: string, coords?: { lat: number; lng: number }): Promise<RamadanTimetable> {
  const params = new URLSearchParams({ tz });
  if (coords) {
    // 2 decimals (~1 km): keeps the public cacheable API from fragmenting and the exact position off the wire.
    params.set("lat", coarse(coords.lat));
    params.set("lng", coarse(coords.lng));
  }
  for (const [k, v] of Object.entries(calcRequestParams(readStoredLocation()))) params.set(k, v);
  const res = await fetch(`/api/ramadan-timetable?${params.toString()}`);
  if (!res.ok) throw new Error(`timetable ${res.status}`);
  return res.json();
}

export function TimetableScreen() {
  const t = useTranslations("timetablePage");
  const tNav = useTranslations("nav");
  const locale = useLocale() as Locale;
  const calcSource = useCalcSource();

  const [timetable, setTimetable] = useState<RamadanTimetable | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [decade, setDecade] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // The location chosen at onboarding wins: its coordinates and zone. Without a valid one the timetable is Dhaka's
    // (Asia/Dhaka, labelled Dhaka), never the device's zone: a browser in UTC used to get Dhaka's sun times printed
    // as UTC clock times (sehri "11:09 PM"). No geolocation on this public page.
    const stored = storedRequestLocation();
    const tz = stored?.tz ?? DHAKA_TIME_ZONE;
    loadTimetable(tz, stored ?? undefined)
      .then((data) => {
        if (cancelled) return;
        setTimetable(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // The caption names the stored district, else Dhaka (the default), in the UI language; a GPS-only location keeps
  // the server's label.
  const placeLabel = useMemo(() => {
    if (!timetable) return null;
    const stored = readStoredLocation();
    const d = districtById(stored?.districtId ?? (stored ? undefined : "dhaka"));
    return d ? districtName(d, locale) : (stored?.label ?? null);
  }, [timetable, locale]);
  const days = timetable?.days ?? [];
  const todayISO = useMemo(
    () => (timetable ? todayISOInZone(new Date(), timetable.timezone) : ""),
    [timetable],
  );
  const activeDecade = decade ?? (timetable ? defaultDecade(days, todayISO) : 0);
  const range = dateRange(days);
  const duringRamadan = timetable ? isRamadanNow(days, todayISO) : false;

  const rowLabels = useCallback(
    (d: TimetableDay) => ({
      weekday: tNav(`weekdays.${d.weekday}` as `weekdays.${WeekdayKey}`),
      sehri: t("sehri"),
      iftar: t("iftar"),
      today: t("today"),
      oddNight: oddNightStartingAfter(d.day) !== null ? t("oddNight", { n: digits(oddNightStartingAfter(d.day)!, locale) }) : null,
      roza: t("rozaLabel", { day: digits(d.day, locale) }),
    }),
    [t, tNav, locale],
  );

  async function share() {
    const url = `${window.location.origin}/timetable`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("title"), text: t("shareText"), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch (e) {
      // The visitor closing the share sheet is not an error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(t("shareError"));
    }
  }

  return (
    <div data-timetable-print className="mx-auto w-full max-w-2xl space-y-4 print:max-w-none print:text-black">
      <div className="space-y-1">
        <h1 className="rp-h1 text-rp-ink print:text-black">{t("title")}</h1>
        {timetable && range ? (
          <p className="rp-small text-rp-muted print:text-black" data-testid="timetable-caption">
            {t("caption", { location: placeLabel ?? timetable.location, range: formatRange(range, locale) })}
          </p>
        ) : null}
        {timetable && !duringRamadan ? <p className="rp-small text-rp-muted print:hidden">{t("nextRamadan")}</p> : null}
        <p className="hidden rp-small print:block">{timetable ? t("printHeading", { year: digits(timetable.hijriYear, locale) }) : null}</p>
      </div>

      {status === "loading" ? (
        <div role="status" aria-label={t("loading")} className="space-y-3">
          <div className="flex gap-2">
            {DECADES.map((d) => (
              <Skeleton key={d.id} className="h-10 w-32 rounded-rp-full" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-rp-lg" />
        </div>
      ) : null}

      {status === "error" ? (
        <Card className="items-center px-5 text-center">
          <p className="rp-body text-rp-muted">{t("error")}</p>
          <Button variant="soft" onClick={() => {
              setStatus("loading");
              setTick((n) => n + 1);
            }}>
            {t("retry")}
          </Button>
        </Card>
      ) : null}

      {status === "ready" && timetable ? (
        <>
          <div role="group" aria-label={t("decades")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden">
            {DECADES.map((d, i) => (
              <Chip key={d.id} selected={activeDecade === i} onClick={() => setDecade(i)} data-decade={d.id}>
                {t(d.id)}
              </Chip>
            ))}
            {/* End gutter: a flex scroll container ignores its end padding. */}
            <span aria-hidden="true" className="w-2 shrink-0" />
          </div>

          <Card className="gap-0 overflow-hidden rounded-rp-lg py-0 print:rounded-none print:shadow-none">
            {DECADES.map((d, i) => (
              <section
                key={d.id}
                aria-label={t(d.id)}
                data-decade-panel={d.id}
                className={activeDecade === i ? "block" : "hidden print:block"}
              >
                <h2 className="hidden px-4 pt-4 text-[16px] font-semibold print:block">{t(d.id)}</h2>
                <ol className="divide-y divide-rp-rule print:divide-neutral-300">
                  {decadeDays(days, i).map((day) => (
                    <TimetableRow key={day.day} day={day} state={rowState(day, todayISO)} locale={locale} labels={rowLabels(day)} />
                  ))}
                </ol>
              </section>
            ))}
          </Card>

          <p className="rp-caption text-rp-muted print:text-black">
            {t("source", { source: calcSource(timetable?.calc) ?? calcSource({ method: 1, school: 1 })! })}
          </p>

          <div className="flex gap-3 print:hidden">
            <Button variant="soft" onClick={share}>
              <ShareIcon />
              {t("share")}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              {t("print")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
