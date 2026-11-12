import { useState, type ComponentType } from "react";
import { Circle, CircleCheck } from "lucide-react";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { SectionHeader } from "@/components/design/section-header";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import {
  DuaIcon,
  HeartIcon,
  PlanIcon,
  QuranIcon,
  TasbihIcon,
  ZakatIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { IFTAR_WINDOW_MS, type PhaseTimings, type PrayerPhase } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { isHiddenPath } from "@/config/features";
import { DuaCard } from "@/components/duas/dua-card";
import { planDisplayOrder, type PlanWindow } from "@/components/plan/plan-logic";

// ── Phase card: Sehri niyyah / Iftar dua ──────────────

export type PhaseCardKind = "niyyah" | "iftarDua";

/** The iftar dua shows from an hour before maghrib (the iftar phase) until this long after it. */
export const IFTAR_DUA_AFTER_MS = 45 * 60_000;

/**
 * Which card follows the Sehri/Iftar pair, in Ramadan only: the niyyah in the Sehri phase, the iftar dua from
 * maghrib − 60 min until maghrib + 45 min.
 */
export function phaseCardKind(
  now: Date,
  phase: PrayerPhase | null | undefined,
  timings: Pick<PhaseTimings, "maghrib"> | null | undefined,
  ramadan: boolean,
): PhaseCardKind | null {
  if (!ramadan || !phase || !timings) return null;
  if (phase === "sehri") return "niyyah";
  const fromMaghrib = now.getTime() - timings.maghrib.getTime();
  if (fromMaghrib >= -IFTAR_WINDOW_MS && fromMaghrib < IFTAR_DUA_AFTER_MS) return "iftarDua";
  return null;
}

export function PhaseCard({ kind, className }: { kind: PhaseCardKind; className?: string }) {
  return (
    <div data-testid="phase-card" data-kind={kind} className={className}>
      <DuaCard id={kind === "niyyah" ? "niyyah" : "iftar"} icon={<DuaIcon size={24} className="text-rp-accent" />} />
    </div>
  );
}

// ── Feature tiles ─────────────────────────────────────

// Only features that are on (src/config/features.ts) get a tile.
type FeatureTile = {
  key: "tileQuran" | "tileDuas" | "tileTasbih" | "tileZakat";
  href: string;
  Icon: ComponentType<IconProps>;
};
export const FEATURE_TILES: ReadonlyArray<FeatureTile> = ([
  { key: "tileQuran", href: "/quran", Icon: QuranIcon },
  { key: "tileDuas", href: "/duas", Icon: DuaIcon },
  { key: "tileTasbih", href: "/tasbih", Icon: TasbihIcon },
  { key: "tileZakat", href: "/zakat", Icon: ZakatIcon },
] as FeatureTile[]).filter((tile) => !isHiddenPath(tile.href));

export function FeatureTiles({ className }: { className?: string }) {
  const t = useTranslations("home");
  return (
    <section aria-labelledby="home-companions" className={cn("flex flex-col gap-3", className)}>
      <SectionHeader title={<span id="home-companions">{t("companions")}</span>} />
      <ul className="grid grid-cols-4 gap-3">
        {FEATURE_TILES.map(({ key, href, Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 rounded-rp-md bg-rp-surface px-1 py-4 text-rp-ink transition-colors outline-none hover:bg-rp-accent-tint/60 focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span className="flex size-11 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
                <Icon size={24} />
              </span>
              <span className="rp-caption text-center">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Today's plan preview ──────────────────────────────

export const PLAN_PREVIEW_COUNT = 3;
export const PLAN_HREF = "/plan";

export interface PlanPreviewRow {
  id: string;
  kind: "task" | "goal";
  title: string;
  done: boolean;
  window: PlanWindow;
  scopeISO: string;
}

/** What the preview needs from today's plan (useTodayPlan): the same rows and counts as /plan. */
export interface PlanPreviewState {
  rows: readonly PlanPreviewRow[];
  done: number;
  total: number;
  /** The list is known (guest storage read or the first server load finished). */
  ready: boolean;
  pending: ReadonlySet<string>;
  toggleRow: (row: PlanPreviewRow, next: boolean) => void;
  /** The last load or save failed (a failed tick is rolled back). */
  error?: boolean;
}

/** How many of the day's deeds the Home lists (Figma: five). */
export const PLAN_PREVIEW_ROWS = 5;

/**
 * Today's plan on the Home (v4 "আজকের আমল"): the section header (title with the same count as /plan, and one
 * "See all" link to /plan), then up to five of the day's deeds as an inset-grouped list that shows their state
 * (circle-check done, circle open). Never the checklist itself: ticking and tracking live on /plan only.
 */
export function PlanPreview({ state, className }: { state: PlanPreviewState; className?: string }) {
  const t = useTranslations("home");
  const tToday = useTranslations("today");
  const tPrayer = useTranslations("prayer");
  const locale = useLocale();
  const ordered = planDisplayOrder(state.rows);
  const next = ordered.find((row) => !row.done);
  // No count for an empty or failed list ("০/০" reads as a score of nothing).
  const showCount = state.ready && state.total > 0;
  // A no-break space holds the line before the list is known.
  const nextText = !state.ready
    ? " "
    : next
      ? t("planNext", { title: next.title })
      : state.rows.length > 0
        ? t("planAllDone")
        : t("planEmpty");
  const shown = state.ready ? ordered.slice(0, PLAN_PREVIEW_ROWS) : [];

  return (
    <section aria-labelledby="home-plan" data-testid="plan-preview" className={cn("flex flex-col gap-2", className)}>
      <SectionHeader
        title={
          <span id="home-plan">
            {/* No count after a failed load with nothing to show: "০/০" would read as an empty plan. */}
            {showCount
              ? t("planTitle", { done: formatLocalizedNumber(state.done, locale), total: formatLocalizedNumber(state.total, locale) })
              : t("planTitleNoCount")}
          </span>
        }
        action={
          <Link href={PLAN_HREF} aria-label={t("planAllLabel")}>
            {tPrayer("seeAll")}
          </Link>
        }
      />
      <ul className="flex flex-col overflow-hidden rounded-rp-md bg-rp-surface">
        {shown.map((row) => {
          const Icon = row.done ? CircleCheck : Circle;
          return (
            <li
              key={row.id}
              className="relative flex min-h-[52px] items-center gap-4 px-4 py-3 text-rp-ink after:absolute after:right-0 after:bottom-0 after:left-14 after:h-px after:bg-rp-rule last:after:hidden"
            >
              <Icon size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className={cn("shrink-0", row.done ? "text-rp-icon" : "text-rp-muted")} />
              <span className="rp-row min-w-0 flex-1">{row.title}</span>
              <span className="sr-only">{tToday(row.done ? "statusDone" : "statusPending")}</span>
            </li>
          );
        })}
        {shown.length === 0 ? (
          <li className="flex min-h-[52px] items-center gap-4 px-4 py-3 text-rp-muted">
            {/* Before the list is known the row only holds its place. */}
            {state.ready ? <PlanIcon size={24} className="shrink-0 text-rp-icon" /> : null}
            <span className="rp-row min-w-0 flex-1" data-testid="plan-preview-next">
              {nextText}
            </span>
          </li>
        ) : null}
      </ul>
      {shown.length > 0 ? (
        <p className="rp-caption px-4 text-rp-muted" data-testid="plan-preview-next">
          {nextText}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" data-testid="plan-preview-error" className="rp-small rounded-rp-md bg-rp-surface px-4 py-3 text-rp-ink">
          {t("planError")}
        </p>
      ) : null}
    </section>
  );
}

// ── Support (sadaqah) card ────────────────────────────

/** Placeholder until the Support page lands (Task 10). */
export const SUPPORT_HREF = "/support";

export function SupportCard({
  lastTen,
  onDismiss,
  className,
}: {
  lastTen: boolean;
  onDismiss: () => void;
  className?: string;
}) {
  const t = useTranslations("home");
  // Hides at once even when storage is unavailable (the stored dismissal then cannot persist).
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section
      aria-labelledby="home-support"
      data-testid="support-card"
      className={cn("flex items-start gap-4 rounded-rp-lg bg-rp-gold-tint p-5 text-rp-ink shadow-rp-soft", className)}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-rp-full bg-rp-surface text-rp-gold-text">
        <HeartIcon size={24} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="home-support" className="rp-row font-semibold">
          {t(lastTen ? "supportTitleLastTen" : "supportTitle")}
        </h2>
        <p className="rp-small text-rp-muted">{t("supportBody")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Link
            href={SUPPORT_HREF}
            className="rp-small inline-flex min-h-12 items-center font-semibold text-rp-gold-text underline-offset-4 hover:underline"
          >
            {t("supportAction")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              onDismiss();
            }}
            aria-label={t("supportDismissLabel")}
            className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "ml-auto min-h-12 text-rp-muted")}
          >
            {t("supportDismiss")}
          </button>
        </div>
      </div>
    </section>
  );
}
