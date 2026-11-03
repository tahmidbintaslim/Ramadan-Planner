"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "@tanstack/react-router";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { districtById, districtName } from "@/lib/districts";
import { needsOnboarding } from "@/lib/user-location";
import { usePrayerPhase } from "@/components/prayer/use-prayer-phase";
import { timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";
import { DailyPractices } from "./daily-practices";
import { HomeOverview, ramadanDayOf } from "./home-overview";
import { useSadaqahDismissal } from "./sadaqah-dismissal";
import { useDailyChecklist } from "./use-daily-checklist";
import { deviceTimeZone, nextDayISO, useHomeTimings } from "./use-home-timings";
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
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();

  // First-run gate (after hydration, so the server and client renders agree): a guest without a chosen location
  // goes to onboarding. Signed-in users are never sent there. Client navigations are gated earlier, in the route.
  useEffect(() => {
    if (needsOnboarding(user !== null)) void router.navigate({ to: "/welcome", replace: true });
  }, [router, user]);

  // Live clock (30 s). Its date in the device zone (the zone the timings are requested for) drives the
  // midnight refetch.
  const { now, todayISO } = usePrayerPhase(null, deviceTimeZone(), { initialNow });
  const home = useHomeTimings(todayISO);
  const timeZone = home.timings?.timezone ?? "Asia/Dhaka";
  const dateISO = safeTodayISO(now, timeZone);

  const phaseTimings = useMemo(() => {
    if (!home.timings || !dateISO) return null;
    const pt = home.timings.prayerTimes;
    // Tomorrow's fajr and sehri end come from tomorrow's answer; without it (offline, upstream error) today's
    // times stand in (they drift by about a minute a day).
    const next = home.tomorrow?.prayerTimes;
    return timingsFromPrayerTimes(pt, dateISO, timeZone, next?.fajr || pt.fajr, next?.sehri || pt.sehri || undefined);
  }, [home.timings, home.tomorrow, dateISO, timeZone]);

  // Tomorrow's sehri, fajr and iftar for the pair after Isha (today's times stand in when tomorrow's are missing).
  const tomorrowTimings = useMemo(() => {
    if (!home.timings || !dateISO) return null;
    const pt = home.tomorrow?.prayerTimes ?? home.timings.prayerTimes;
    return timingsFromPrayerTimes(pt, nextDayISO(dateISO), timeZone, pt.fajr);
  }, [home.timings, home.tomorrow, dateISO, timeZone]);

  const ramadanDay = ramadanDayOf(home.ramadan);
  const checklist = useDailyChecklist(ramadanDay ?? 1);
  const { reminders, toggle } = usePrayerReminders();
  const sadaqah = useSadaqahDismissal();
  // The district chosen at onboarding names the hero's location pill (in the UI language).
  const chosen = districtById(home.location?.districtId);
  const districtLabel = chosen ? districtName(chosen, locale) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
      <h1 className="sr-only">{t("title")}</h1>
      <HomeOverview
        status={home.status}
        timings={home.timings}
        phaseTimings={phaseTimings}
        tomorrowTimings={tomorrowTimings}
        cached={home.cached}
        districtLabel={districtLabel}
        locationHref="/welcome"
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
