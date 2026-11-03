"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { BookOpen, Bell, CheckCircle2, Target } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getDailyLogAction,
  listPlanTasksAction,
  listPrayerGoalsAction,
  listReminderRulesAction,
} from "@/actions/planner";
import { useAuth } from "@/components/providers/auth-provider";
import { getTodayKey, useGuestData } from "@/hooks/use-guest-data";
import { useGuestReminderRules } from "@/lib/guest-reminders";
import { cn } from "@/lib/utils";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { DAILY_TRACKER_MARKERS } from "@/lib/daily-tracker-markers";

const FARD_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

type ManualState = {
  quranRead: boolean;
  hadithRead: boolean;
};

const DEFAULT_MANUAL_STATE: ManualState = {
  quranRead: false,
  hadithRead: false,
};

function fromChecklist(checklist: string[]): ManualState {
  return {
    quranRead: checklist.includes(DAILY_TRACKER_MARKERS.quran),
    hadithRead: checklist.includes(DAILY_TRACKER_MARKERS.hadith),
  };
}

export function DailyIbadahTracker({ day }: { day: number }) {
  const tDashboard = useTranslations("dashboard");
  const tToday = useTranslations("today");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const { isGuest, loading } = useAuth();
  const [, startTransition] = useTransition();

  const {
    data: guestData,
  } = useGuestData<ManualState>(
    getTodayKey("daily_ibadah_tracker"),
    DEFAULT_MANUAL_STATE,
  );
  const { data: guestGoals } = useGuestData<Array<{ isCompleted: boolean }>>(
    getTodayKey("plan_goals"),
    [],
  );
  const { data: guestTasks } = useGuestData<Array<{ isDone: boolean }>>(
    getTodayKey("plan_tasks"),
    [],
  );
  const { data: guestReminders } = useGuestReminderRules();
  const { data: guestPrayers } = useGuestData<Record<string, boolean>>(
    getTodayKey("salah"),
    {},
  );
  const { data: guestQuran } = useGuestData<{
    para: string;
    surah: string;
    ayah: string;
    pages: string;
  }>(getTodayKey("quran"), {
    para: "",
    surah: "",
    ayah: "",
    pages: "",
  });

  const [serverPrayerCount, setServerPrayerCount] = useState(0);
  const [serverQuranTouched, setServerQuranTouched] = useState(false);
  const [serverManualState, setServerManualState] =
    useState<ManualState>(DEFAULT_MANUAL_STATE);
  const [goalStats, setGoalStats] = useState({ total: 0, done: 0 });
  const [taskStats, setTaskStats] = useState({ total: 0, done: 0 });
  const [reminderStats, setReminderStats] = useState({ total: 0, enabled: 0 });

  useEffect(() => {
    if (loading || isGuest) return;

    const loadAll = () => {
      startTransition(async () => {
        const [logRes, goalsRes, tasksRes, remindersRes] = await Promise.all([
          getDailyLogAction(day),
          listPrayerGoalsAction(),
          listPlanTasksAction(),
          listReminderRulesAction(),
        ]);

        if (logRes.ok && logRes.data) {
          const nextPrayerCount = FARD_PRAYERS.filter(
            (prayer) => Boolean(logRes.data?.prayers?.[prayer]),
          ).length;
          const quran = logRes.data.quran;
          const hasQuranProgress =
            Boolean(quran.surah?.trim()) ||
            Number.parseInt(quran.para || "0", 10) > 0 ||
            Number.parseInt(quran.pages || "0", 10) > 0 ||
            Number.parseInt(quran.ayah || "0", 10) > 0;

          setServerPrayerCount(nextPrayerCount);
          setServerQuranTouched(hasQuranProgress);
          setServerManualState(fromChecklist(logRes.data.checklist));
        }

        if (goalsRes.ok) {
          const done = goalsRes.data.filter((g) => g.isCompleted).length;
          setGoalStats({ total: goalsRes.data.length, done });
        }

        if (tasksRes.ok) {
          const done = tasksRes.data.filter((t) => t.isDone).length;
          setTaskStats({ total: tasksRes.data.length, done });
        }

        if (remindersRes.ok) {
          const enabled = remindersRes.data.filter((r) => r.enabled).length;
          setReminderStats({ total: remindersRes.data.length, enabled });
        }
      });
    };

    loadAll();
    const onRefresh = () => loadAll();
    window.addEventListener("rp-tracker-updated", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("rp-tracker-updated", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [day, isGuest, loading]);

  const guestPrayerCount = useMemo(
    () =>
      FARD_PRAYERS.filter((prayer) => Boolean(guestPrayers?.[prayer])).length,
    [guestPrayers],
  );

  const guestQuranTouched = useMemo(
    () =>
      Boolean(guestQuran?.surah?.trim()) ||
      Number.parseInt(guestQuran?.para || "0", 10) > 0 ||
      Number.parseInt(guestQuran?.pages || "0", 10) > 0 ||
      Number.parseInt(guestQuran?.ayah || "0", 10) > 0,
    [guestQuran],
  );

  const prayerCount = isGuest ? guestPrayerCount : serverPrayerCount;
  const quranTouched = isGuest ? guestQuranTouched : serverQuranTouched;
  const manualState = isGuest ? guestData : serverManualState;
  const effectiveGoalStats = isGuest
    ? {
        total: guestGoals.length,
        done: guestGoals.filter((g) => Boolean(g.isCompleted)).length,
      }
    : goalStats;
  const effectiveTaskStats = isGuest
    ? {
        total: guestTasks.length,
        done: guestTasks.filter((t) => Boolean(t.isDone)).length,
      }
    : taskStats;
  const effectiveReminderStats = isGuest
    ? {
        total: guestReminders.length,
        enabled: guestReminders.filter((r) => Boolean(r.enabled)).length,
      }
    : reminderStats;

  const completedBuckets = useMemo(() => {
    let done = 0;
    if (prayerCount >= 5) done += 1;
    if (quranTouched) done += 1;
    if (manualState.hadithRead) done += 1;
    if (effectiveGoalStats.total > 0 && effectiveGoalStats.done > 0) done += 1;
    if (effectiveTaskStats.total > 0 && effectiveTaskStats.done > 0) done += 1;
    if (effectiveReminderStats.total > 0 && effectiveReminderStats.enabled > 0) {
      done += 1;
    }
    return done;
  }, [
    effectiveGoalStats.done,
    effectiveGoalStats.total,
    effectiveReminderStats.enabled,
    effectiveReminderStats.total,
    effectiveTaskStats.done,
    effectiveTaskStats.total,
    manualState.hadithRead,
    prayerCount,
    quranTouched,
  ]);

  const progressValue = (completedBuckets / 6) * 100;

  const rows = [
    {
      key: "prayer",
      label: tToday("progressPrayer"),
      icon: CheckCircle2,
      done: prayerCount >= 5,
      detail: `${formatLocalizedNumber(prayerCount, locale)}/${formatLocalizedNumber(5, locale)} ${tSalah("fard")}`,
      toggleable: false,
    },
    {
      key: "quran",
      label: tToday("progressQuran"),
      icon: BookOpen,
      done: quranTouched || manualState.quranRead,
      detail:
        quranTouched || manualState.quranRead
          ? tToday("statusDone")
          : tToday("statusPending"),
    },
    {
      key: "hadith",
      label: tToday("progressHadith"),
      icon: BookOpen,
      done: manualState.hadithRead,
      detail: manualState.hadithRead ? tToday("statusDone") : tToday("statusPending"),
    },
    {
      key: "goal",
      label: tToday("progressGoal"),
      icon: Target,
      done: effectiveGoalStats.total > 0 && effectiveGoalStats.done > 0,
      detail:
        effectiveGoalStats.total > 0
          ? tToday("trackerGoalsSummary", {
              done: formatLocalizedNumber(effectiveGoalStats.done, locale),
              total: formatLocalizedNumber(effectiveGoalStats.total, locale),
            })
          : tToday("trackerNoGoals"),
    },
    {
      key: "task",
      label: tToday("progressTask"),
      icon: Target,
      done: effectiveTaskStats.total > 0 && effectiveTaskStats.done > 0,
      detail:
        effectiveTaskStats.total > 0
          ? tToday("trackerTasksSummary", {
              done: formatLocalizedNumber(effectiveTaskStats.done, locale),
              total: formatLocalizedNumber(effectiveTaskStats.total, locale),
            })
          : tToday("trackerNoTasks"),
    },
    {
      key: "reminder",
      label: tToday("progressReminder"),
      icon: Bell,
      done: effectiveReminderStats.total > 0 && effectiveReminderStats.enabled > 0,
      detail:
        effectiveReminderStats.total > 0
          ? tToday("trackerRemindersSummary", {
              enabled: formatLocalizedNumber(effectiveReminderStats.enabled, locale),
              total: formatLocalizedNumber(effectiveReminderStats.total, locale),
            })
          : tToday("trackerNoReminders"),
    },
  ];

  return (
    <>
      <Card data-testid="daily-tracker">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="rp-h2 text-rp-ink">{tDashboard("dailyTrackerTitle")}</h3>
            <span className="rp-small rounded-rp-full bg-rp-accent-tint px-3 py-1 font-semibold tabular-nums text-rp-accent">
              {formatLocalizedNumber(completedBuckets, locale)}/{formatLocalizedNumber(6, locale)}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="rp-caption flex items-center justify-between text-rp-muted">
              <span>{tDashboard("todayProgress")}</span>
              <span>{formatLocalizedNumber(Math.round(progressValue), locale)}%</span>
            </div>
            <Progress value={progressValue} className="h-2" aria-label={tDashboard("todayProgress")} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className={cn(
                "flex min-h-16 items-center justify-between gap-3 rounded-rp-md px-4 py-3",
                row.done ? "bg-rp-accent-tint" : "bg-rp-page",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <row.icon aria-hidden="true" className={cn("size-5 shrink-0", row.done ? "text-rp-accent" : "text-rp-muted")} />
                <div className="min-w-0">
                  <p className="rp-row truncate text-rp-ink">{row.label}</p>
                  <p className="rp-caption text-rp-muted">{row.detail}</p>
                </div>
              </div>

              <span
                className={cn(
                  "rp-caption shrink-0 rounded-rp-full px-3 py-1",
                  row.done ? "bg-rp-live text-rp-on-live" : "border border-rp-rule bg-rp-surface text-rp-ink",
                )}
              >
                {row.done ? tToday("statusDone") : tToday("statusPending")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
