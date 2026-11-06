import type { ComponentType } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { SectionHeader } from "@/components/design/section-header";
import { Link } from "@/components/shared/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  AsrIcon,
  BellIcon,
  DhuhrIcon,
  FajrIcon,
  IshaIcon,
  MaghribIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";
import type { PhaseTimings } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { useClockFormat } from "@/hooks/use-clock-format";
import { FIVE_PRAYERS, formatPrayerClock, useNowTick, type FivePrayer } from "./use-prayer-phase";

const ICONS: Record<FivePrayer, ComponentType<IconProps>> = {
  fajr: FajrIcon,
  dhuhr: DhuhrIcon,
  asr: AsrIcon,
  maghrib: MaghribIcon,
  isha: IshaIcon,
};

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
  /** Freeze the clock (tests, previews). */
  now?: Date;
  /** Server render time for hydration-safe first render (see PrayerHero). */
  initialNow?: Date;
  className?: string;
}

export function PrayerList({
  timings,
  timeZone,
  reminders,
  onToggleReminder,
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
    <section className={cn("flex flex-col gap-1.5", className)}>
      <SectionHeader
        title={t("todayPrayers")}
        action={<Link href={REMINDERS_HREF}>{t("reminders")}</Link>}
      />
      <ul className="flex flex-col rounded-rp-lg bg-rp-surface p-1 shadow-rp-soft">
        {FIVE_PRAYERS.map((key) => {
          const Icon = ICONS[key];
          const state = states[key];
          const name = tSalah(key);
          const enabled = Boolean(reminders?.[key]);
          const bellClass = cn(
            buttonVariants({ variant: "quiet", size: "icon" }),
            "-mr-3 size-11 shrink-0",
            state === "past" && "text-rp-muted",
          );
          return (
            <li
              key={key}
              data-prayer={key}
              data-state={state}
              aria-current={state === "next" ? "time" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-rp-md px-4",
                state === "next" && "bg-rp-accent-tint text-rp-accent",
                state === "past" && "text-rp-muted",
                state === "upcoming" && "text-rp-ink",
              )}
            >
              <Icon
                size={24}
                className={cn("shrink-0", state === "past" ? "text-rp-strong" : "text-rp-accent")}
              />
              <span className={cn("rp-row flex-1 truncate", state === "next" && "font-semibold")}>{name}</span>
              {state === "next" ? <Badge>{t("next")}</Badge> : null}
              <span className={cn("rp-row tabular-nums", state === "next" && "font-semibold")}>
                {formatPrayerClock(timings[key], timeZone, locale, clockFormat)}
              </span>
              {onToggleReminder ? (
                <button
                  type="button"
                  aria-pressed={enabled}
                  aria-label={t("reminderToggle", { name })}
                  onClick={() => onToggleReminder(key, !enabled)}
                  className={bellClass}
                >
                  <BellIcon size={20} className="size-5" fill={enabled ? "currentColor" : "none"} />
                </button>
              ) : (
                <Link href={REMINDERS_HREF} aria-label={t("reminderManage", { name })} className={bellClass}>
                  <BellIcon size={20} className="size-5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
