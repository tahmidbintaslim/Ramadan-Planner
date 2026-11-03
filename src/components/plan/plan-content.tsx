"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useKnownTimings, useRamadanDay } from "@/hooks/use-shell-day";
import { useNowTick } from "@/components/prayer/use-prayer-phase";
import { digits, ddmmyyyyToISO, formatClock, type Locale } from "@/components/timetable/timetable-logic";
import { shouldShowSadaqah, timingsFromPrayerTimes, todayISOInZone } from "@/lib/prayer-phase";
import { AddAmalSheet, type NewAmal } from "./add-amal-sheet";
import { ChecklistCards, ChecklistOverline, type ChecklistRowItem } from "./checklist";
import { NightHero, OddNightsCard, PlanSupportCard } from "./night-view";
import { useItemNotes } from "./plan-item-meta";
import {
  DAY_DEFAULTS,
  NIGHT_DEFAULTS,
  PLAN_WINDOWS,
  currentNight,
  defaultPlanView,
  groupByWindow,
  isNightKey,
  itemMessageKey,
  lastTenVisible,
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
import { usePlanTimetable, useQuranProgress, useSadaqahDismissal } from "./use-plan-context";

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
  const { notes, remember, forget } = useItemNotes();
  const quran = useQuranProgress();
  const ramadanDay = useRamadanDay();
  const now = useNowTick();
  const { timetable, failed: timetableFailed } = usePlanTimetable(ramadanDay !== null);
  const [viewChoice, setViewChoice] = useState<"day" | "nights" | null>(null);
  const [editing, setEditing] = useState(false);
  // Suggested night practices being added (a second tap must not add a duplicate).
  const [adding, setAdding] = useState<ReadonlySet<string>>(() => new Set());
  const sadaqah = useSadaqahDismissal();

  // ── Ramadan day, today's times, the last ten nights ──
  const tz = timetable?.timezone ?? deviceZone();
  const days = useMemo(() => timetable?.days ?? [], [timetable]);
  const todayRow = ramadanDay !== null ? days.find((d) => d.day === ramadanDay) : undefined;
  const fajrToday = rowInstant(todayRow, "fajr", tz);
  const maghribToday = rowInstant(todayRow, "maghrib", tz);
  const showNights = lastTenVisible(ramadanDay, now, maghribToday);
  const view = showNights ? (viewChoice ?? defaultPlanView(true, now, fajrToday, maghribToday)) : "day";
  const night = ramadanDay !== null ? currentNight(ramadanDay, now, fajrToday) : 0;
  const tonight = showNights ? nightTimes(days, night, tz) : null;
  const known = useKnownTimings(view === "nights");
  const todayISO = todayISOInZone(now, tz);
  const knownToday = known && known.date === todayISOInZone(now, known.timezone) ? known : null;

  // ── Items: the plan's tasks and goals with their window, suggestion key and meta line ──
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

  const items: PlanItem[] = [
    ...plan.tasks.map((task): PlanItem => {
      const note = notes[task.id];
      const key = matchDefaultKey(task.title, note?.key, titlesByKey);
      const para = nextPara(quran.para);
      return {
        id: task.id,
        kind: "task",
        // The Quran suggestion names the para to read next (from the Quran tracker).
        title: key === "quran" ? t("items.quranPara", { n: locale === "bn" ? bnOrdinal(para) : String(para) }) : task.title,
        done: task.isDone,
        key,
        window: note?.window ?? (key ? DEFAULTS_BY_KEY[key]?.window : undefined) ?? windowFromTitle(task.title),
        meta: metaFor(key),
      };
    }),
    ...plan.goals.map((goal): PlanItem => {
      const note = notes[goal.id];
      return {
        id: goal.id,
        kind: "goal",
        title: goal.title,
        done: goal.isCompleted,
        window: note?.window ?? windowFromTitle(goal.title),
        meta: t("itemMeta.goalTarget", { count: digits(goal.targetCount, locale), unit: goal.targetUnit }),
      };
    }),
  ];
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups = groupByWindow(items);
  const done = items.filter((i) => i.done).length;
  const presentKeys = new Set(items.map((i) => i.key).filter(Boolean));

  const toggle = (row: ChecklistRowItem, next: boolean) => {
    const item = byId.get(row.id);
    if (item) {
      plan.toggle(item.kind, item.id, next);
      return;
    }
    // A suggested night practice that is not in the list yet: ticking it adds it, already done.
    const key = row.id.replace(/^default:/, "");
    const def = DEFAULTS_BY_KEY[key];
    if (!def || adding.has(key)) return;
    setAdding((prev) => new Set(prev).add(key));
    void plan
      .addTask(titleOf(key), next)
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

  const removeItem = (row: ChecklistRowItem) => {
    const item = byId.get(row.id);
    if (!item) return;
    plan.remove(item.kind, item.id);
    forget(item.id);
  };

  const addDefaults = async (defaults: readonly DefaultItem[]) => {
    for (const def of defaults) {
      if (presentKeys.has(def.key)) continue;
      const id = await plan.addTask(titleOf(def.key));
      if (id) remember(id, { window: def.window, key: def.key });
    }
  };

  const addAmal = async ({ title, window, targetCount }: NewAmal): Promise<boolean> => {
    const id = targetCount
      ? await plan.addGoal(title, targetCount, t("defaultTargetUnit"))
      : await plan.addTask(title);
    if (!id) return false;
    remember(id, { window });
    return true;
  };

  const suggestions = [
    ...DAY_DEFAULTS.filter((d) => !presentKeys.has(d.key)).map((d) => titleOf(d.key)),
    t("templateTaskMealPlan"),
    t("templateTaskFamily"),
    t("templateTaskCharity"),
  ];

  // Tonight's practices: the ones in the list plus the suggestions not added yet.
  const nightRows: ChecklistRowItem[] = NIGHT_DEFAULTS.map((def) => {
    const existing = items.find((i) => i.key === def.key);
    return existing ?? { id: `default:${def.key}`, title: titleOf(def.key), done: adding.has(def.key), meta: metaFor(def.key) };
  });
  const otherNightItems = items.filter((i) => isNightKey(i.key) && !NIGHT_DEFAULTS.some((d) => d.key === i.key));

  // Sadaqah card: the shared visibility rule (never in the sehri phase or within 15 minutes of a prayer).
  const phaseTimings = knownToday
    ? timingsFromPrayerTimes(knownToday.prayerTimes, todayISOInZone(now, knownToday.timezone), knownToday.timezone, knownToday.prayerTimes.fajr)
    : null;
  const showSupport =
    view === "nights" && phaseTimings !== null && shouldShowSadaqah(now, phaseTimings, { ramadanDay, dismissedAt: sadaqah.dismissedAt });

  // ── Header ──
  const eveningRow = days.find((d) => d.day === night - 1);
  const caption = !mounted
    ? null
    : view === "nights" && eveningRow
      ? t("captionNight", { night: digits(night, locale), date: longDate(ddmmyyyyToISO(eveningRow.gregorianDate), locale) })
      : ramadanDay !== null
        ? t("captionRoza", { day: digits(ramadanDay, locale), date: longDate(todayISO, locale) })
        : longDate(todayISO, locale);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-view={view}>
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
      ) : null}

      {!plan.loading && plan.isGuest ? (
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
          ) : timetableFailed ? (
            <p className="rp-small rounded-rp-lg bg-rp-surface p-5 text-rp-muted shadow-rp-soft">{t("nightsError")}</p>
          ) : (
            <div role="status" aria-label={t("nightsLoading")}>
              <Skeleton className="h-[300px] rounded-rp-xl" />
            </div>
          )}
          {days.length > 0 ? <OddNightsCard rows={oddNightRows(days, night)} /> : null}
          <section aria-labelledby="tonight-amal" className="flex flex-col gap-3">
            <ChecklistOverline id="tonight-amal">{t("tonightAmal")}</ChecklistOverline>
            <ChecklistCards items={[...nightRows, ...otherNightItems]} onToggle={toggle} labelledBy="tonight-amal" />
          </section>
          {showSupport ? <PlanSupportCard onDismiss={sadaqah.dismiss} /> : null}
        </>
      ) : (
        <>
          <ProgressCard done={done} total={items.length} quranPara={quran.para} streak={quran.streak} />
          {items.length === 0 ? (
            <section aria-labelledby="plan-empty" className="flex flex-col gap-3 rounded-rp-lg bg-rp-surface p-5 shadow-rp-soft">
              <h2 id="plan-empty" className="rp-row font-semibold text-rp-ink">
                {t("emptyTitle")}
              </h2>
              <p className="rp-small text-rp-muted">{t("emptyBody")}</p>
              <Button type="button" onClick={() => void addDefaults(DAY_DEFAULTS)} disabled={plan.isPending}>
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
                      onRemove={removeItem}
                      editing={editing}
                      labelledBy={`plan-${w}`}
                    />
                  ) : (
                    <p className="rp-small rounded-rp-lg border border-dashed border-rp-rule px-4 py-3 text-rp-muted">{t("groupEmpty")}</p>
                  )}
                </section>
              ))
            : null}
          <AddAmalSheet onAdd={addAmal} suggestions={suggestions} />
          {items.length > 0 ? (
            <Button type="button" variant="quiet" className="self-center" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
              {editing ? t("doneEditing") : t("editList")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
