"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/use-intl";
import { useOnboardingGate } from "@/components/onboarding/use-onboarding-gate";
import { districtById, districtName } from "@/lib/districts";
import { readStoredLocation } from "@/lib/user-location";
import { usePrayerPhase } from "@/components/prayer/use-prayer-phase";
import { timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";
import { HomeOverview, ramadanDayOf } from "./home-overview";
import { WelcomeCard } from "@/components/onboarding/welcome-card";
import { useSadaqahDismissal } from "./sadaqah-dismissal";
import { useTodayPlan } from "@/components/plan/use-today-plan";
import { nightEveningISO } from "@/components/plan/plan-logic";
import { deviceTimeZone, nextDayISO, useHomeTimings } from "./use-home-timings";
import { usePrayerReminders } from "./use-prayer-reminders";

const subscribeNoop = () => () => {};

function safeTodayISO(now: Date, timeZone: string): string | null {
  try {
    return todayISOInZone(now, timeZone);
  } catch {
    return null;
  }
}

/**
 * The Home (Today) screen, a focused daily-use screen: greeting (app header), hero, Sehri/Iftar pair, the one sourced
 * devotional card (niyyah at sehri, iftar dua near iftar, otherwise the day's ayah), prayers, companion tiles,
 * today's plan preview and the rule-gated sadaqah card. The trackers, checklist and journal live on /plan.
 *
 * `initialNow` is the server's render time (route loader), so the server and hydrating renders agree.
 */
export function TodayContent({ initialNow }: { initialNow?: Date }) {
  const locale = useLocale();

  // First-run gate (resolved after hydration, so the server and client renders agree): a guest without a chosen
  // location goes to onboarding; signed-in users never do. Until it clears, the Home shows its skeleton and
  // fetches nothing. Client navigations are gated earlier, in the route's beforeLoad.
  const gate = useOnboardingGate();
  // The zone of the location chosen at onboarding names "today" (read after mount; null on the server).
  const storedTz = useSyncExternalStore(subscribeNoop, () => readStoredLocation()?.tz ?? null, () => null);

  // Live clock (30 s). Its date in the zone the timings are requested for (the stored location's, else the
  // device's) drives the midnight refetch.
  const { now, todayISO } = usePrayerPhase(null, storedTz ?? deviceTimeZone(), { initialNow });
  const home = useHomeTimings(todayISO, { enabled: gate === "clear" });
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
  // Today's plan (the same rows and counts as /plan).
  // Night practices count for the night's evening, as on /plan (yesterday's date between midnight and fajr).
  const eveningISO = dateISO
    ? nightEveningISO(ramadanDay, now, phaseTimings?.fajr ?? null, phaseTimings?.maghrib ?? null, dateISO)
    : null;
  const today = useTodayPlan(dateISO ?? todayISO, eveningISO);
  const plan = {
    rows: today.rows,
    done: today.done,
    total: today.total,
    ready: today.plan.ready,
    pending: today.plan.pending,
    toggleRow: today.toggleRow,
    error: today.plan.error,
  };
  const { reminders, toggle } = usePrayerReminders();
  const sadaqah = useSadaqahDismissal();
  // The district chosen at onboarding names the hero's location pill (in the UI language).
  const chosen = districtById(home.location?.districtId);
  const districtLabel = chosen ? districtName(chosen, locale) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col">
      <WelcomeCard />
      <HomeOverview
        status={home.status}
        timings={home.timings}
        phaseTimings={phaseTimings}
        tomorrowTimings={tomorrowTimings}
        cached={home.cached}
        districtLabel={districtLabel}
        ramadan={home.ramadan}
        now={now}
        initialNow={initialNow}
        reminders={reminders}
        onToggleReminder={toggle}
        plan={plan}
        sadaqahDismissedAt={sadaqah.dismissedAt}
        onDismissSadaqah={() => sadaqah.dismiss()}
        onRetry={home.retry}
      />
    </div>
  );
}
