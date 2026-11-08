"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useKnownTimings, useRamadanDay } from "@/hooks/use-shell-day";
import { useClockFormat } from "@/hooks/use-clock-format";
import { useClockWhen } from "@/components/prayer/use-prayer-phase";
import { digits, ddmmyyyyToISO, formatClock, type Locale } from "@/components/timetable/timetable-logic";
import { shouldShowSadaqah, timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";
import { AddAmalButton, AmalSheet, type AmalDraft, type AmalEditTarget, type AmalSuggestion } from "./add-amal-sheet";
import { ChecklistCards, ChecklistOverline, type ChecklistRowItem } from "./checklist";
import { NightHero, OddNightsCard, QadrDuaCard } from "./night-view";
import { SupportCard } from "@/components/today/home-sections";
import { useSadaqahDismissal } from "@/components/today/sadaqah-dismissal";
import {
  DAY_DEFAULTS,
  LEGACY_DEFAULTS,
  NIGHT_DEFAULTS,
  PLAN_WINDOWS,
  currentNight,
  defaultPlanView,
  nightsViewAvailable,
  tickScopeISO,
  groupByWindow,
  isNightKey,
  itemMessageKey,
  nightTimes,
  oddNightRows,
  rowInstant,
  type DefaultItem,
  type PlanItem,
} from "./plan-logic";
import { ProgressCard } from "./progress-card";
import { SalahTracker } from "./trackers/salah-tracker";
import { QuranTracker } from "./trackers/quran-tracker";
import { JournalSection } from "./trackers/journal-section";
import { useTodayPlan } from "./use-today-plan";
import { usePlanTimetable } from "./use-plan-context";

const DEFAULTS_BY_KEY: Record<string, DefaultItem> = Object.fromEntries(
  [...DAY_DEFAULTS, ...LEGACY_DEFAULTS, ...NIGHT_DEFAULTS].map((d) => [d.key, d]),
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

/** `cookieGuest`: the request has no session cookie (the route loader reads it on the server and in the browser). */
export function PlanContent({ cookieGuest = false }: { cookieGuest?: boolean }) {
  const t = useTranslations("plan");
  const tChecklist = useTranslations("checklist");
  const locale = useLocale() as Locale;
  const [clockFormat] = useClockFormat();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const ramadanDay = useRamadanDay();
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
  // Re-render on a boundary (day/night view, night number, local date), not on every clock tick: this page
  // has no countdown of its own (the night hero keeps its own live clock).
  const now = useClockWhen((d) =>
    [
      nightsViewAvailable(ramadanDay, d, fajrToday, maghribToday),
      defaultPlanView(true, d, fajrToday, maghribToday),
      ramadanDay !== null ? currentNight(ramadanDay, d, fajrToday) : 0,
      todayISOInZone(d, tz),
      Math.floor(d.getTime() / 600_000), // the sadaqah card and known-timings date at least every 10 min
    ].join("|"),
  );
  const showNights = nightsViewAvailable(ramadanDay, now, fajrToday, maghribToday);
  const view = showNights ? (viewChoice ?? defaultPlanView(true, now, fajrToday, maghribToday)) : "day";
  const night = ramadanDay !== null ? currentNight(ramadanDay, now, fajrToday) : 0;
  const tonight = showNights ? nightTimes(days, night, tz) : null;
  const known = useKnownTimings(view === "nights");
  const todayISO = todayISOInZone(now, tz);
  const knownToday = known && known.date === todayISOInZone(now, known.timezone) ? known : null;
  const eveningRow = showNights ? days.find((d) => d.day === night - 1) : undefined;
  const eveningISO = eveningRow ? ddmmyyyyToISO(eveningRow.gregorianDate) : null;
  const today = useTodayPlan(todayISO, eveningISO);
  const { plan, remember, forget, quran, titleOf } = today;

  // ── Items: the plan's tasks and goals with their window, suggestion key, meta line and done-for-the-day ──
  const metaFor = (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    const msg = itemMessageKey(key);
    if (STATIC_META.has(msg)) return t(`itemMeta.${msg}` as "itemMeta.quran");
    if (key === "sehri" && todayRow) return formatClock(todayRow.sehri, locale, clockFormat);
    if (key === "fajr" && todayRow) return formatClock(todayRow.fajr, locale, clockFormat);
    if (key === "night:ishaTaraweeh" && knownToday) return formatClock(knownToday.prayerTimes.isha, locale, clockFormat);
    if (key === "night:tahajjud" && tonight) {
      const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(tonight.tahajjud);
      return t("itemMeta.tahajjudAt", { time: formatClock(hhmm, locale, clockFormat) });
    }
    return undefined;
  };

  type Item = PlanItem & { rawTitle: string; scopeISO: string; targetCount?: number };
  const items: Item[] = today.rows.map(
    (row): Item => ({
      id: row.id,
      kind: row.kind,
      rawTitle: row.rawTitle,
      title: row.title,
      done: row.done,
      key: row.key,
      scopeISO: row.scopeISO,
      window: row.window,
      targetCount: row.targetCount,
      meta:
        row.kind === "goal"
          ? t("itemMeta.goalTarget", { count: digits(row.targetCount ?? 1, locale), unit: row.targetUnit ?? "" })
          : metaFor(row.key),
    }),
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  // Day view: tasks by time of day in "আজকের আমল", goals (a target count) in "আমার লক্ষ্য"; nothing shows twice.
  const tasks = items.filter((i) => i.kind === "task");
  const goals = items.filter((i) => i.kind === "goal");
  const taskGroups = groupByWindow(tasks);
  const done = items.filter((i) => i.done).length;
  const presentKeys = new Set(items.map((i) => i.key).filter(Boolean));
  const locked = !plan.ready;

  const toggle = (row: ChecklistRowItem, next: boolean) => {
    if (locked) return;
    const item = byId.get(row.id);
    if (item) {
      today.toggleRow(item, next);
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
    // The former separate dhikr checklist (merged here so nothing is ticked in two lists); morning dhikr and
    // charity are already day suggestions.
    { title: tChecklist("eveningDhikr") },
    { title: tChecklist("istighfar") },
    { title: tChecklist("durud") },
    { title: tChecklist("goodDeeds") },
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

      {/* Before the list is known, the request's session cookie says whether this is a guest: the notice holds its place. */}
      {(plan.ready ? plan.isGuest : cookieGuest) ? (
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
            <NightHero times={tonight} night={night} timeZone={tz} location={timetable.location} hijriYear={timetable.hijriYear} />
          ) : timetableFailed || timetable ? (
            <p className="rp-small rounded-rp-lg bg-rp-surface p-5 text-rp-muted shadow-rp-soft">{t("nightsError")}</p>
          ) : (
            <div role="status" aria-label={t("nightsLoading")}>
              <Skeleton className="h-[300px] rounded-rp-xl" />
            </div>
          )}
          <p className="rp-reading-small rounded-rp-lg bg-rp-surface px-5 py-4 text-rp-ink shadow-rp-soft" data-testid="nights-intro">
            {t("nightsIntro")}
          </p>
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

          {/* 1. আজকের আমল: today's checklist by time of day (tasks; goals with a target are in "আমার লক্ষ্য"). */}
          <section aria-labelledby="plan-today-amal" data-testid="plan-today-amal" className="flex flex-col gap-4">
            <h2 id="plan-today-amal" className="rp-h2 text-rp-ink">
              {t("todayAmal")}
            </h2>
            {!plan.ready ? (
              // The empty-list card's height, until the list is known (most first visits end there).
              <div aria-hidden="true" data-testid="plan-list-skeleton" className="h-[178px] rounded-rp-lg bg-rp-surface shadow-rp-soft motion-safe:animate-pulse regular:h-[156px]" />
            ) : null}
            {items.length === 0 && plan.ready ? (
              <div className="flex flex-col gap-3 rounded-rp-lg bg-rp-surface p-5 shadow-rp-soft">
                <h3 className="rp-row font-semibold text-rp-ink">{t("emptyTitle")}</h3>
                <p className="rp-small text-rp-muted">{t("emptyBody")}</p>
                <Button type="button" onClick={() => void addDefaults(DAY_DEFAULTS)} disabled={defaultsBusy}>
                  {t("addSuggested")}
                </Button>
              </div>
            ) : null}
            {tasks.length > 0
              ? PLAN_WINDOWS.map((w) => (
                  <section key={w} aria-labelledby={`plan-${w}`} data-window={w} className="flex flex-col gap-3">
                    <ChecklistOverline id={`plan-${w}`} as="h3">
                      {t(`windows.${w}`)}
                    </ChecklistOverline>
                    {taskGroups[w].length > 0 ? (
                      <ChecklistCards
                        items={taskGroups[w]}
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
          </section>

          {/* 2-3. The trackers (their own data flows: guest local storage or the daily log), keyed by the Ramadan
              day (day 1 outside Ramadan). Fajr and the Quran have no checklist suggestion of their own, so neither is
              recorded twice. */}
          <SalahTracker day={ramadanDay ?? 1} />
          <QuranTracker day={ramadanDay ?? 1} />

          {/* 4. আমার লক্ষ্য: the user's own goals with a target count (e.g. ১০০ বার যিকির). */}
          <section aria-labelledby="plan-goals" data-testid="plan-goals" className="flex flex-col gap-3">
            <h2 id="plan-goals" className="rp-h2 text-rp-ink">
              {t("goalsTitle")}
            </h2>
            {goals.length > 0 ? (
              <ChecklistCards items={goals} onToggle={toggle} onEdit={openEdit} disabled={locked} pending={plan.pending} labelledBy="plan-goals" />
            ) : (
              <p className="rp-small rounded-rp-lg border border-dashed border-rp-rule px-4 py-3 text-rp-muted">{t("goalsEmpty")}</p>
            )}
          </section>

          {/* 5. রমজান ডায়েরি: optional, collapsed by default. */}
          <JournalSection day={ramadanDay ?? 1} />
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
