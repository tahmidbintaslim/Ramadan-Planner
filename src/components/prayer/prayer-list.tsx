import { Bell, Circle, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { SectionHeader } from "@/components/design/section-header";
import { Link } from "@/components/shared/link";
import { Badge } from "@/components/ui/badge";
import { LUCIDE_STROKE, TIMETABLE_HREF } from "@/components/layout/nav-items";
import type { PhaseTimings } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { useClockFormat } from "@/hooks/use-clock-format";
import { FIVE_PRAYERS, formatPrayerClock, useNowTick, type FivePrayer } from "./use-prayer-phase";

export const REMINDERS_HREF = "/reminders";

export type PrayerRowState = "past" | "next" | "upcoming";

/** Row state for each of today's five prayers: the first one still ahead is "next". */
export function prayerRowStates(
  now: Date,
  timings: Pick<PhaseTimings, FivePrayer>,
): Record<FivePrayer, PrayerRowState> {
  const n = now.getTime();
  let nextFound = false;
  const out = {} as Record<FivePrayer, PrayerRowState>;
  for (const key of FIVE_PRAYERS) {
    if (timings[key].getTime() <= n) {
      out[key] = "past";
    } else if (!nextFound) {
      out[key] = "next";
      nextFound = true;
    } else {
      out[key] = "upcoming";
    }
  }
  return out;
}

export interface PrayerListProps {
  timings: Pick<PhaseTimings, FivePrayer>;
  timeZone: string;
  /** Which prayers have an enabled reminder (bell filled state). */
  reminders?: Partial<Record<FivePrayer, boolean>>;
  /**
   * Toggle a prayer's reminder. When omitted the bell is a link to /reminders (reminders are
   * rule-based there: offset + channels, guest local storage or server), so nothing is toggled here.
   */
  onToggleReminder?: (prayer: FivePrayer, enabled: boolean) => void;
  /** Hide the bells (the landing page, which has no reminders). */
  hideReminders?: boolean;
  /** The source line under the list ("উৎস: AlAdhan · করাচি · হানাফি আসর"). */
  source?: string;
  /** Hide the section header (the landing page's card stack has none). */
  hideHeader?: boolean;
  /** Freeze the clock (tests, previews). */
  now?: Date;
  /** Server render time for hydration-safe first render (see PrayerHero). */
  initialNow?: Date;
  className?: string;
}

/**
 * Today's prayers (v4): an inset-grouped list, radius 16, rows 48 on compact and 56 from medium (all five clear the
 * tab bar at 390×844). Leading 24 state icon in the 16 inset (past: circle-check accent; next: tonal row + teal
 * chip; upcoming: circle secondary), the name grows, the time hugs the trailing edge with tabular figures, and each
 * separator starts where the text starts (x = 56). A trailing 44 bell keeps the per-prayer reminder toggle.
 */
export function PrayerList({
  timings,
  timeZone,
  reminders,
  onToggleReminder,
  hideReminders = false,
  source,
  hideHeader = false,
  now: nowOverride,
  initialNow,
  className,
}: PrayerListProps) {
  const t = useTranslations("prayer");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  const now = useNowTick(nowOverride, initialNow);
  const states = prayerRowStates(now, timings);

  return (
    <section aria-label={hideHeader ? t("todayPrayers") : undefined} className={cn("flex flex-col gap-2", className)}>
      {hideHeader ? null : <SectionHeader title={t("todayPrayers")} action={<Link href={TIMETABLE_HREF}>{t("seeAll")}</Link>} />}
      <ul className="flex flex-col overflow-hidden rounded-rp-md bg-rp-surface">
        {FIVE_PRAYERS.map((key) => {
          const state = states[key];
          const name = tSalah(key);
          const enabled = Boolean(reminders?.[key]);
          const StateIcon = state === "past" ? CircleCheck : Circle;
          const bellClass = cn(
            "-mr-3 flex size-11 shrink-0 items-center justify-center rounded-rp-full transition-colors hover:bg-rp-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
            enabled ? "text-rp-accent" : "text-rp-muted",
          );
          return (
            <li
              key={key}
              data-prayer={key}
              data-state={state}
              aria-current={state === "next" ? "time" : undefined}
              className={cn(
                "relative flex h-12 items-center gap-3 px-4 text-rp-ink min-[380px]:gap-4 medium:h-14",
                "after:absolute after:right-0 after:bottom-0 after:left-14 after:h-px after:bg-rp-rule last:after:hidden",
                state === "next" && "bg-rp-accent-tint",
              )}
            >
              <StateIcon
                size={24}
                strokeWidth={LUCIDE_STROKE}
                aria-hidden
                className={cn("shrink-0", state === "upcoming" ? "text-rp-muted" : "text-rp-icon")}
              />
              <span className={cn("rp-row min-w-0 flex-1 truncate", state === "next" && "font-semibold")}>{name}</span>
              {/* Below 380 px the badge cut the name to "আ…"; the tinted, bold row (and aria-current) still mark it. */}
              {state === "next" ? <Badge className="hidden min-[380px]:inline-flex">{t("next")}</Badge> : null}
              <span
                className={cn("rp-headline whitespace-nowrap text-right tabular-nums", state === "past" && "text-rp-muted")}
                suppressHydrationWarning
              >
                {formatPrayerClock(timings[key], timeZone, locale, clockFormat)}
              </span>
              {hideReminders ? null : onToggleReminder ? (
                <button
                  type="button"
                  aria-pressed={enabled}
                  aria-label={t("reminderToggle", { name })}
                  onClick={() => onToggleReminder(key, !enabled)}
                  className={bellClass}
                >
                  <Bell size={20} strokeWidth={LUCIDE_STROKE} aria-hidden fill={enabled ? "currentColor" : "none"} />
                </button>
              ) : (
                <Link href={REMINDERS_HREF} aria-label={t("reminderManage", { name })} className={bellClass}>
                  <Bell size={20} strokeWidth={LUCIDE_STROKE} aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {source ? (
        <p data-testid="hero-source" className="rp-caption text-rp-muted">
          {source}
        </p>
      ) : null}
    </section>
  );
}
