"use client";

import { useMemo } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { usePrayerPhase } from "@/components/prayer/use-prayer-phase";
import { timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";
import { DailyPractices } from "./daily-practices";
import { HomeOverview, ramadanDayOf } from "./home-overview";
import { useSadaqahDismissal } from "./sadaqah-dismissal";
import { useDailyChecklist } from "./use-daily-checklist";
import { deviceTimeZone, useHomeTimings } from "./use-home-timings";
import { usePrayerReminders } from "./use-prayer-reminders";

function safeTodayISO(now: Date, timeZone: string): string | null {
  try {
    return todayISOInZone(now, timeZone);
  } catch {
    return null;
  }
}

/**
 * The Home (Today) screen: the time-aware overview (hero, Sehri/Iftar pair, phase card, prayers, companion tiles,
 * today's plan, sadaqah card), then the day's practices and trackers that used to make up this page.
 *
 * `initialNow` is the server's render time (route loader), so the server and hydrating renders agree.
 */
export function TodayContent({ initialNow }: { initialNow?: Date }) {
  const t = useTranslations("today");

  // The day boundary follows the device zone until timings arrive, then the timings' zone.
  // Live clock (30 s). Its date in the device zone (the zone the timings are requested for) drives the
  // midnight refetch.
  const { now, todayISO } = usePrayerPhase(null, deviceTimeZone(), { initialNow });
  const home = useHomeTimings(todayISO);
  const timeZone = home.timings?.timezone ?? "Asia/Dhaka";
  const dateISO = safeTodayISO(now, timeZone);

  const phaseTimings = useMemo(() => {
    if (!home.timings || !dateISO) return null;
    const pt = home.timings.prayerTimes;
    // The API answers one day; tomorrow's fajr is about a minute from today's, so today's stands in for it.
    return timingsFromPrayerTimes(pt, dateISO, timeZone, pt.fajr);
  }, [home.timings, dateISO, timeZone]);

  const ramadanDay = ramadanDayOf(home.ramadan);
  const checklist = useDailyChecklist(ramadanDay ?? 1);
  const { reminders, toggle } = usePrayerReminders();
  const sadaqah = useSadaqahDismissal();

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
      <h1 className="sr-only">{t("title")}</h1>
      <HomeOverview
        status={home.status}
        timings={home.timings}
        phaseTimings={phaseTimings}
        cached={home.cached}
        ramadan={home.ramadan}
        now={now}
        initialNow={initialNow}
        reminders={reminders}
        onToggleReminder={toggle}
        checklist={checklist}
        sadaqahDismissedAt={sadaqah.dismissedAt}
        onDismissSadaqah={() => sadaqah.dismiss()}
        onRetry={home.retry}
      />
      <DailyPractices ramadanDay={ramadanDay} checklist={checklist} />
    </div>
  );
}
