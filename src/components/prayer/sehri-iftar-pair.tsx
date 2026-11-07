import type { ComponentType } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { CrescentIcon, DatesIcon, type IconProps } from "@/components/icons/islamic-icons";
import type { PhaseTimings } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { useClockFormat } from "@/hooks/use-clock-format";
import { formatPrayerClock } from "./use-prayer-phase";

export interface SehriIftarPairProps {
  /** Today's timings; sehri uses `sehriEnd` when it is before fajr (else fajr), iftar uses maghrib. */
  timings: Pick<PhaseTimings, "fajr" | "maghrib" | "sehriEnd">;
  timeZone: string;
  /** Small label above the times, e.g. "আগামীকাল" when the cards show tomorrow's sehri and iftar. */
  dayLabel?: string;
  className?: string;
}

function TimeCard({ Icon, label, time, testId }: { Icon: ComponentType<IconProps>; label: string; time: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-rp-md bg-rp-surface p-4">
      <Icon size={24} className="shrink-0 text-rp-icon max-[359px]:hidden" />
      <div className="min-w-0">
        <p className="rp-caption whitespace-nowrap text-rp-muted">{label}</p>
        <p className="rp-h2 whitespace-nowrap tabular-nums text-rp-ink" data-testid={testId}>
          {time}
        </p>
      </div>
    </div>
  );
}

/**
 * The Sehri / Iftar pair (v4): two equal cards, gap 16, padding 16, radius 16. The founder's Hugeicons Islamic icons
 * at 24 in the accent (ramadan-01 for sehri, dates for iftar: the clearer iftar sign), label Footnote secondary,
 * time Title 3.
 */
export function SehriIftarPair({ timings, timeZone, dayLabel, className }: SehriIftarPairProps) {
  const t = useTranslations("prayer");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  // Same guard as the phase engine: a sehri end at or after fajr is ignored.
  const sehriEnd =
    timings.sehriEnd && timings.sehriEnd.getTime() < timings.fajr.getTime() ? timings.sehriEnd : timings.fajr;
  const sehri = formatPrayerClock(sehriEnd, timeZone, locale, clockFormat);
  const iftar = formatPrayerClock(timings.maghrib, timeZone, locale, clockFormat);

  return (
    <div data-day={dayLabel ? "tomorrow" : "today"} className={cn("flex flex-col gap-2", className)}>
      {dayLabel ? (
        <p data-testid="pair-day" className="rp-caption px-4 text-rp-accent">
          {dayLabel}
        </p>
      ) : null}
      <div className="flex gap-4">
        <TimeCard Icon={CrescentIcon} label={t("sehriEnds")} time={sehri} testId="pair-sehri" />
        <TimeCard Icon={DatesIcon} label={t("iftar")} time={iftar} testId="pair-iftar" />
      </div>
    </div>
  );
}
