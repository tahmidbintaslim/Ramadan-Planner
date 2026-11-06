import { useLocale, useTranslations } from "@/i18n/use-intl";
import { FajrIcon, MaghribIcon } from "@/components/icons/islamic-icons";
import type { PhaseTimings } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { useClockFormat } from "@/hooks/use-clock-format";
import { formatPrayerClock } from "./use-prayer-phase";

export interface SehriIftarPairProps {
  /** Today's timings; sehri uses `sehriEnd` when it is before fajr (else fajr), iftar uses maghrib. */
  timings: Pick<PhaseTimings, "fajr" | "maghrib" | "sehriEnd">;
  timeZone: string;
  /** Small label above the times, e.g. "আগামীকাল" when the card shows tomorrow's sehri and iftar. */
  dayLabel?: string;
  className?: string;
}

/** White card with today's sehri end (left) and iftar (right), split by a 1px rule. */
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
    <div
      data-day={dayLabel ? "tomorrow" : "today"}
      className={cn(
        "grid grid-cols-[1fr_1px_1fr] items-center rounded-rp-lg bg-rp-surface p-4 text-rp-ink shadow-rp-soft",
        className,
      )}
    >
      {dayLabel ? (
        <p data-testid="pair-day" className="rp-caption col-span-3 mb-2 text-rp-accent">
          {dayLabel}
        </p>
      ) : null}
      <div className="flex min-w-0 items-center gap-3 pr-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
          <FajrIcon size={22} />
        </span>
        <div className="min-w-0">
          <p className="rp-caption text-rp-muted">{t("sehriEnds")}</p>
          <p className="rp-h2 tabular-nums" data-testid="pair-sehri">
            {sehri}
          </p>
        </div>
      </div>
      <span aria-hidden="true" className="h-10 w-px bg-rp-rule" />
      <div className="flex min-w-0 items-center gap-3 pl-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-rp-full bg-rp-gold-tint text-rp-gold-text">
          <MaghribIcon size={22} />
        </span>
        <div className="min-w-0">
          <p className="rp-caption text-rp-muted">{t("iftar")}</p>
          <p className="rp-h2 tabular-nums" data-testid="pair-iftar">
            {iftar}
          </p>
        </div>
      </div>
    </div>
  );
}
