"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useCalcSource } from "@/components/prayer/use-calc-source";
import { toast } from "sonner";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareIcon } from "@/components/icons/islamic-icons";
import { Printer } from "lucide-react";
import { oddNightStartingAfter } from "@/lib/ramadan-nights";
import { todayISOInZone } from "@/lib/prayer-phase";
import { readStoredLocation, subscribeStoredLocation } from "@/lib/user-location";
// The stored location's coordinates and zone, else Dhaka's (never the device zone); no geolocation on this public page.
import { screenTimetableUrl, useCached } from "@/lib/data-cache";
import { districtById, districtName } from "@/lib/districts";
import type { RamadanTimetable, TimetableDay } from "@/lib/ramadan-timetable";
import { TIMETABLE_GRID, TimetableRow } from "./timetable-row";
import {
  DECADES,
  type Locale,
  dateRange,
  decadeDays,
  defaultDecade,
  digits,
  formatRange,
  isRamadanNow,
  rowState,
} from "./timetable-logic";

type WeekdayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export function TimetableScreen() {
  const t = useTranslations("timetablePage");
  const tNav = useTranslations("nav");
  const locale = useLocale() as Locale;
  const calcSource = useCalcSource();

  const [decade, setDecade] = useState<number | null>(null);
  // Shared data cache: a revisit (or a hover-preloaded visit) renders the table at once.
  const url = useSyncExternalStore(subscribeStoredLocation, screenTimetableUrl, () => null);
  const { data, error, retry } = useCached<RamadanTimetable>(url);
  const timetable = data ?? null;
  const status: "loading" | "ready" | "error" = timetable ? "ready" : error ? "error" : "loading";

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
        <h1 className="rp-large-title text-rp-ink print:text-black">{t("title")}</h1>
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
          <Button variant="soft" onClick={retry}>
            {t("retry")}
          </Button>
        </Card>
      ) : null}

      {status === "ready" && timetable ? (
        <>
          {/* HIG segmented control (Figma page 12, D4): the visible label is the short name, the accessible name the
              full one (it starts with the visible text). */}
          <div role="group" aria-label={t("decades")} className="grid h-9 grid-cols-3 rounded-rp-input bg-rp-accent-tint p-0.5 print:hidden">
            {DECADES.map((d, i) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={activeDecade === i}
                aria-label={t(d.id)}
                onClick={() => setDecade(i)}
                data-decade={d.id}
                className={cn(
                  "rp-small min-w-0 truncate rounded-[7px] px-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
                  activeDecade === i ? "bg-rp-surface text-rp-ink shadow-sm" : "text-rp-muted hover:text-rp-ink",
                )}
              >
                {t(`${d.id}Short`)}
              </button>
            ))}
          </div>

          <Card className="gap-0 overflow-hidden rounded-rp-lg py-0 print:rounded-none print:shadow-none">
            <div
              aria-hidden="true"
              className={cn(TIMETABLE_GRID, "rp-caption grid gap-x-3 border-b border-rp-rule px-4 py-2 text-rp-muted print:text-black")}
            >
              <span>{t("rozaShort")}</span>
              <span>{t("date")}</span>
              <span className="text-end">{t("sehri")}</span>
              <span className="text-end">{t("iftar")}</span>
            </div>
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
            {t("tableNote")}{" "}
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
