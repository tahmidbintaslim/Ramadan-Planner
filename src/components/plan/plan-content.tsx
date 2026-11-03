"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useKnownTimings, useRamadanDay } from "@/hooks/use-shell-day";
import { useNowTick } from "@/components/prayer/use-prayer-phase";
import { digits, ddmmyyyyToISO, formatClock, type Locale } from "@/components/timetable/timetable-logic";
import { shouldShowSadaqah, timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";
import { AddAmalButton, AmalSheet, type AmalDraft, type AmalEditTarget, type AmalSuggestion } from "./add-amal-sheet";
import { ChecklistCards, ChecklistOverline, type ChecklistRowItem } from "./checklist";
import { NightHero, OddNightsCard, QadrDuaCard } from "./night-view";
import { SupportCard } from "@/components/today/home-sections";
import { useSadaqahDismissal } from "@/components/today/sadaqah-dismissal";
import { useItemNotes } from "./plan-item-meta";
import {
  DAY_DEFAULTS,
  NIGHT_DEFAULTS,
  PLAN_WINDOWS,
  currentNight,
  defaultPlanView,
  doneForDay,
  goalDoneForDay,
  nightsViewAvailable,
  tickScopeISO,
  groupByWindow,
  isNightKey,
  itemMessageKey,
  matchDefaultKey,
  nightTimes,
  oddNightRows,
  rowInstant,
  windowFromTitle,
  bnOrdinal,
  nextPara,
  type DefaultItem,
  type PlanItem,
} from "./plan-logic";
import { ProgressCard } from "./progress-card";
import { usePlanItems } from "./use-plan-items";
import { usePlanTimetable, useQuranProgress } from "./use-plan-context";

const DEFAULTS_BY_KEY: Record<string, DefaultItem> = Object.fromEntries(
  [...DAY_DEFAULTS, ...NIGHT_DEFAULTS].map((d) => [d.key, d]),
);
// Plain durations and the source line; "sehri", "fajr", "ishaTaraweeh" and "tahajjud" show times instead.
const STATIC_META = new Set(["morningDhikr", "quran", "sleepDhikr", "nightQuran", "qadrDua"]);

const subscribeNoop = () => () => {};

/** "শুক্রবার, ২০ ফেব্রুয়ারি" for a YYYY-MM-DD date (null on the server, the date is the device's). */
function longDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(at);
  const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", timeZone: "UTC" }).format(at);
  return `${weekday}, ${date}`;
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
  } catch {
    return "Asia/Dhaka";
  }
}

export function PlanContent() {
  const t = useTranslations("plan");
  const locale = useLocale() as Locale;
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const plan = usePlanItems();
  const liveIds = useMemo(
    () => (plan.ready ? new Set([...plan.tasks.map((x) => x.id), ...plan.goals.map((x) => x.id)]) : null),
    [plan.ready, plan.tasks, plan.goals],
  );
  const { notes, remember, forget } = useItemNotes(liveIds);
  const quran = useQuranProgress();
  const ramadanDay = useRamadanDay();
  const now = useNowTick();
  const { timetable, failed: timetableFailed } = usePlanTimetable(ramadanDay !== null);
  const [viewChoice, setViewChoice] = useState<"day" | "nights" | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; editing: AmalEditTarget | null }>({ open: false, editing: null });
  // Suggested night practices being added (a second tap must not add a duplicate).
  const [adding, setAdding] = useState<ReadonlySet<string>>(() => new Set());
  const addingDefaults = useRef(false);
  const [defaultsBusy, setDefaultsBusy] = useState(false);
  const sadaqah = useSadaqahDismissal();

  // ── Ramadan day, today's times, the last ten nights ──
  const tz = timetable?.timezone ?? deviceZone();
  const days = useMemo(() => timetable?.days ?? [], [timetable]);
  const todayRow = ramadanDay !== null ? days.find((d) => d.day === ramadanDay) : undefined;
  const fajrToday = rowInstant(todayRow, "fajr", tz);
  const maghribToday = rowInstant(todayRow, "maghrib", tz);
  const showNights = nightsViewAvailable(ramadanDay, now, fajrToday, maghribToday);
  const view = showNights ? (viewChoice ?? defaultPlanView(true, now, fajrToday, maghribToday)) : "day";
  const night = ramadanDay !== null ? currentNight(ramadanDay, now, fajrToday) : 0;
  const tonight = showNights ? nightTimes(days, night, tz) : null;
  const known = useKnownTimings(view === "nights");
  const todayISO = todayISOInZone(now, tz);
  const knownToday = known && known.date === todayISOInZone(now, known.timezone) ? known : null;
  const eveningRow = showNights ? days.find((d) => d.day === night - 1) : undefined;
  const eveningISO = eveningRow ? ddmmyyyyToISO(eveningRow.gregorianDate) : null;

  // ── Items: the plan's tasks and goals with their window, suggestion key, meta line and done-for-the-day ──
  const titleOf = (key: string) => t(`items.${itemMessageKey(key)}` as "items.sehri");
  const titlesByKey: Record<string, string[]> = Object.fromEntries(Object.keys(DEFAULTS_BY_KEY).map((k) => [k, [titleOf(k)]]));

  const metaFor = (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    const msg = itemMessageKey(key);
    if (STATIC_META.has(msg)) return t(`itemMeta.${msg}` as "itemMeta.quran");
    if (key === "sehri" && todayRow) return formatClock(todayRow.sehri, locale);
    if (key === "fajr" && todayRow) return formatClock(todayRow.fajr, locale);
    if (key === "night:ishaTaraweeh" && knownToday) return formatClock(knownToday.prayerTimes.isha, locale);
    if (key === "night:tahajjud" && tonight) {
      const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(tonight.tahajjud);
      return t("itemMeta.tahajjudAt", { time: formatClock(hhmm, locale) });
    }
    return undefined;
  };

  const para = nextPara(quran.para);
  type Item = PlanItem & { rawTitle: string; scopeISO: string; targetCount?: number };
  const items: Item[] = [
    ...plan.tasks.map((task): Item => {
      const note = notes[task.id];
      const key = matchDefaultKey(task.title, note?.key, titlesByKey);
      const scopeISO = tickScopeISO(isNightKey(key), todayISO, eveningISO);
      return {
        id: task.id,
        kind: "task",
        rawTitle: task.title,
        // The Quran suggestion names the para to read next (from the Quran tracker).
        title: key === "quran" ? t("items.quranPara", { n: locale === "bn" ? bnOrdinal(para) : String(para) }) : task.title,
        // Guest lists are stored per day; signed-in ticks count for the day they were made.
        done: plan.isGuest ? task.isDone : doneForDay(task, scopeISO),
        key,
        scopeISO,
        window: note?.window ?? (key ? DEFAULTS_BY_KEY[key]?.window : undefined) ?? windowFromTitle(task.title),
        meta: metaFor(key),
      };
    }),
    ...plan.goals.map((goal): Item => {
      const note = notes[goal.id];
      return {
        id: goal.id,
        kind: "goal",
        rawTitle: goal.title,
        title: goal.title,
        done: plan.isGuest ? goal.isCompleted : goalDoneForDay(goal.isCompleted, note?.doneOn, todayISO),
        scopeISO: todayISO,
        targetCount: goal.targetCount,
        window: note?.window ?? windowFromTitle(goal.title),
        meta: t("itemMeta.goalTarget", { count: digits(goal.targetCount, locale), unit: goal.targetUnit }),
      };
    }),
  ];
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups = groupByWindow(items);
  const done = items.filter((i) => i.done).length;
  const presentKeys = new Set(items.map((i) => i.key).filter(Boolean));
  const locked = !plan.ready;

  const toggle = (row: ChecklistRowItem, next: boolean) => {
    if (locked) return;
    const item = byId.get(row.id);
    if (item) {
      plan.toggle(item.kind, item.id, next, item.scopeISO);
      if (item.kind === "goal" && !plan.isGuest) remember(item.id, { doneOn: item.scopeISO });
      return;
    }
    // A suggested night practice that is not in the list yet: ticking it adds it, already done.
    const key = row.id.replace(/^default:/, "");
    const def = DEFAULTS_BY_KEY[key];
    if (!def || adding.has(key)) return;
    setAdding((prev) => new Set(prev).add(key));
    void plan
      .addTask(titleOf(key), next ? tickScopeISO(true, todayISO, eveningISO) : undefined)
      .then((id) => {
        if (id) remember(id, { window: def.window, key });
      })
      .finally(() =>
        setAdding((prev) => {
          const rest = new Set(prev);
          rest.delete(key);
          return rest;
        }),
      );
  };

  const addDefaults = async (defaults: readonly DefaultItem[]) => {
    if (addingDefaults.current || locked) return;
    addingDefaults.current = true;
    setDefaultsBusy(true);
    try {
      for (const def of defaults) {
        if (presentKeys.has(def.key)) continue;
        const id = await plan.addTask(titleOf(def.key));
        if (id) remember(id, { window: def.window, key: def.key });
      }
    } finally {
      addingDefaults.current = false;
      setDefaultsBusy(false);
    }
  };

  const addAmal = async ({ title, window, targetCount }: AmalDraft): Promise<boolean> => {
    const id = targetCount ? await plan.addGoal(title, targetCount, t("defaultTargetUnit")) : await plan.addTask(title);
    if (!id) return false;
    remember(id, { window });
    return true;
  };

  const saveAmal = async (item: AmalEditTarget, { title, window, targetCount }: AmalDraft): Promise<boolean> => {
    const current = byId.get(item.id);
    if (!current) return false;
    if (title !== current.rawTitle || (item.kind === "goal" && targetCount && targetCount !== current.targetCount)) {
      const ok =
        item.kind === "goal"
          ? await plan.updateGoal(item.id, title, targetCount ?? current.targetCount ?? 1)
          : await plan.updateTask(item.id, title);
      if (!ok) return false;
    }
    remember(item.id, { window });
    return true;
  };

  const deleteAmal = async (item: AmalEditTarget): Promise<boolean> => {
    const ok = await plan.remove(item.kind, item.id);
    if (ok) forget(item.id);
    return ok;
  };

  const openEdit = (row: ChecklistRowItem) => {
    const item = byId.get(row.id);
    if (!item) return;
    setSheet({
      open: true,
      editing: { id: item.id, kind: item.kind, title: item.rawTitle, window: item.window, targetCount: item.targetCount },
    });
  };

  const suggestions: AmalSuggestion[] = [
    ...DAY_DEFAULTS.filter((d) => !presentKeys.has(d.key)).map((d) => ({ title: titleOf(d.key) })),
    // The earlier goal templates (target in "times").
    { title: t("templateGoalQuran"), targetCount: 2 },
    { title: t("templateGoalHadith"), targetCount: 1 },
    { title: t("templateGoalDhikr"), targetCount: 100 },
    { title: t("templateGoalDua"), targetCount: 5 },
    { title: t("templateTaskMealPlan") },
    { title: t("templateTaskFamily") },
    { title: t("templateTaskCharity") },
  ];

  // Tonight's practices: the ones in the list plus the suggestions not added yet.
  const nightRows: ChecklistRowItem[] = NIGHT_DEFAULTS.map((def) => {
    const existing = items.find((i) => i.key === def.key);
    return existing ?? { id: `default:${def.key}`, title: titleOf(def.key), done: adding.has(def.key), meta: metaFor(def.key) };
  });
  const otherNightItems = items.filter((i) => isNightKey(i.key) && !NIGHT_DEFAULTS.some((d) => d.key === i.key));
  const nightPending = new Set([...plan.pending, ...[...adding].map((k) => `default:${k}`)]);

  // Sadaqah card: the shared visibility rule (never in the sehri phase or within 15 minutes of a prayer).
  const phaseTimings = knownToday
    ? timingsFromPrayerTimes(knownToday.prayerTimes, todayISOInZone(now, knownToday.timezone), knownToday.timezone, knownToday.prayerTimes.fajr)
    : null;
  const showSupport =
    view === "nights" && phaseTimings !== null && shouldShowSadaqah(now, phaseTimings, { ramadanDay, dismissedAt: sadaqah.dismissedAt });

  // ── Header ──
  const caption = !mounted
    ? null
    : view === "nights" && eveningRow
      ? t("captionNight", { night: digits(night, locale), date: longDate(ddmmyyyyToISO(eveningRow.gregorianDate), locale) })
      : ramadanDay !== null
        ? t("captionRoza", { day: digits(ramadanDay, locale), date: longDate(todayISO, locale) })
        : longDate(todayISO, locale);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-view={view} data-ready={plan.ready || undefined}>
      <div className="space-y-1">
        <h1 className="rp-h1 text-rp-ink">{view === "nights" ? t("nightsTitle") : t("dayTitle")}</h1>
        <p className="rp-small min-h-[22px] text-rp-muted" data-testid="plan-caption" suppressHydrationWarning>
          {caption}
        </p>
      </div>

      {showNights ? (
        <div role="group" aria-label={t("views")} className="flex gap-2">
          <Chip selected={view === "day"} onClick={() => setViewChoice("day")}>
            {t("dayTitle")}
          </Chip>
          <Chip selected={view === "nights"} onClick={() => setViewChoice("nights")}>
            {t("nightsTitle")}
          </Chip>
        </div>
      ) : ramadanDay === 20 ? (
        // Roza 20: the switch appears at maghrib; keep its row so the page does not jump.
        <div aria-hidden="true" className="h-10" data-testid="plan-views-placeholder" />
      ) : null}

      {plan.ready && plan.isGuest ? (
        <p className="rp-caption rounded-rp-md bg-rp-accent-tint px-3 py-2 text-rp-ink">{t("guestLocalNotice")}</p>
      ) : null}
      {plan.error ? (
        <p role="alert" className="rp-small rounded-rp-md bg-destructive/10 px-3 py-2 text-destructive">
          {t("genericError")}
        </p>
      ) : null}

      {view === "nights" ? (
        <>
          {tonight && timetable ? (
            <NightHero times={tonight} now={now} night={night} timeZone={tz} location={timetable.location} hijriYear={timetable.hijriYear} />
          ) : timetableFailed || timetable ? (
            <p className="rp-small rounded-rp-lg bg-rp-surface p-5 text-rp-muted shadow-rp-soft">{t("nightsError")}</p>
          ) : (
            <div role="status" aria-label={t("nightsLoading")}>
              <Skeleton className="h-[300px] rounded-rp-xl" />
            </div>
          )}
          {days.length > 0 ? <OddNightsCard rows={oddNightRows(days, night)} /> : null}
          <section aria-labelledby="tonight-amal" className="flex flex-col gap-3">
            <ChecklistOverline id="tonight-amal">{t("tonightAmal")}</ChecklistOverline>
            <ChecklistCards
              items={[...nightRows, ...otherNightItems]}
              onToggle={toggle}
              disabled={locked}
              pending={nightPending}
              labelledBy="tonight-amal"
            />
          </section>
          <QadrDuaCard />
          {showSupport ? <SupportCard lastTen onDismiss={() => sadaqah.dismiss()} /> : null}
        </>
      ) : (
        <>
          <ProgressCard done={done} total={items.length} quranPara={quran.para} streak={quran.streak} />
          {items.length === 0 && plan.ready ? (
            <section aria-labelledby="plan-empty" className="flex flex-col gap-3 rounded-rp-lg bg-rp-surface p-5 shadow-rp-soft">
              <h2 id="plan-empty" className="rp-row font-semibold text-rp-ink">
                {t("emptyTitle")}
              </h2>
              <p className="rp-small text-rp-muted">{t("emptyBody")}</p>
              <Button type="button" onClick={() => void addDefaults(DAY_DEFAULTS)} disabled={defaultsBusy}>
                {t("addSuggested")}
              </Button>
            </section>
          ) : null}
          {items.length > 0
            ? PLAN_WINDOWS.map((w) => (
                <section key={w} aria-labelledby={`plan-${w}`} data-window={w} className="flex flex-col gap-3">
                  <ChecklistOverline id={`plan-${w}`}>{t(`windows.${w}`)}</ChecklistOverline>
                  {groups[w].length > 0 ? (
                    <ChecklistCards
                      items={groups[w]}
                      onToggle={toggle}
                      onEdit={openEdit}
                      disabled={locked}
                      pending={plan.pending}
                      labelledBy={`plan-${w}`}
                    />
                  ) : (
                    <p className="rp-small rounded-rp-lg border border-dashed border-rp-rule px-4 py-3 text-rp-muted">{t("groupEmpty")}</p>
                  )}
                </section>
              ))
            : null}
          <AddAmalButton disabled={locked} onClick={() => setSheet({ open: true, editing: null })} />
        </>
      )}
      <AmalSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        editing={sheet.editing}
        suggestions={suggestions}
        onAdd={addAmal}
        onSave={saveAmal}
        onDelete={deleteAmal}
      />
    </div>
  );
}
