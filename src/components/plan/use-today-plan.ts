import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { useItemNotes } from "./plan-item-meta";
import {
  DAY_DEFAULTS,
  NIGHT_DEFAULTS,
  bnOrdinal,
  buildPlanRows,
  itemMessageKey,
  nextPara,
  type PlanRowSource,
  type PlanWindow,
} from "./plan-logic";
import { usePlanItems } from "./use-plan-items";
import { useQuranProgress } from "./use-plan-context";

const DEFAULT_WINDOWS: Record<string, PlanWindow> = Object.fromEntries(
  [...DAY_DEFAULTS, ...NIGHT_DEFAULTS].map((d) => [d.key, d.window]),
);

export type TodayPlanRow = PlanRowSource & { title: string };

/**
 * Today's plan (the /plan tasks and goals) with each row's display title and done-for-the-day state. The /plan
 * screen and the Home preview both read it, so they always show the same items and counts.
 */
export function useTodayPlan(todayISO: string, eveningISO: string | null = null) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const plan = usePlanItems();
  const liveIds = useMemo(
    () => (plan.ready ? new Set([...plan.tasks.map((x) => x.id), ...plan.goals.map((x) => x.id)]) : null),
    [plan.ready, plan.tasks, plan.goals],
  );
  const { notes, remember, forget } = useItemNotes(liveIds);
  const quran = useQuranProgress();

  const titleOf = useCallback((key: string) => t(`items.${itemMessageKey(key)}` as "items.sehri"), [t]);
  const titlesByKey = useMemo<Record<string, string[]>>(
    () => Object.fromEntries(Object.keys(DEFAULT_WINDOWS).map((k) => [k, [titleOf(k)]])),
    [titleOf],
  );

  const para = nextPara(quran.para);
  const rows: TodayPlanRow[] = buildPlanRows({
    tasks: plan.tasks,
    goals: plan.goals,
    isGuest: plan.isGuest,
    notes,
    titlesByKey,
    defaultWindows: DEFAULT_WINDOWS,
    todayISO,
    eveningISO,
  }).map((row) => ({
    ...row,
    // The Quran suggestion names the para to read next (from the Quran tracker).
    title:
      row.key === "quran" ? t("items.quranPara", { n: locale === "bn" ? bnOrdinal(para) : String(para) }) : row.rawTitle,
  }));
  const done = rows.filter((r) => r.done).length;

  /** Ticks or unticks a row for its day (goal ticks remember the day on this device when signed in). */
  const toggleRow = (row: Pick<PlanRowSource, "id" | "kind" | "scopeISO">, next: boolean) => {
    if (!plan.ready || plan.pending.has(row.id)) return;
    if (row.kind !== "goal" || plan.isGuest) {
      plan.toggle(row.kind, row.id, next, row.scopeISO);
      return;
    }
    // Signed-in goal ticks keep their day in the item note; a failed save restores the previous day.
    const previous = notes[row.id]?.doneOn;
    remember(row.id, { doneOn: row.scopeISO });
    plan.toggle(row.kind, row.id, next, row.scopeISO, (ok) => {
      if (!ok) remember(row.id, { doneOn: previous });
    });
  };

  return { plan, notes, remember, forget, quran, titleOf, titlesByKey, rows, done, total: rows.length, toggleRow };
}

export type TodayPlanState = ReturnType<typeof useTodayPlan>;
