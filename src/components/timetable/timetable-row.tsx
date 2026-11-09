import { cn } from "@/lib/utils";
import type { TimetableDay } from "@/lib/ramadan-timetable";
import { oddNightStartingAfter } from "@/lib/ramadan-nights";
import { useClockFormat } from "@/hooks/use-clock-format";
import { clockParts } from "@/lib/clock-format";
import { type Locale, type RowState, digits, formatRowDate } from "./timetable-logic";

export interface TimetableRowLabels {
  weekday: string;
  sehri: string;
  iftar: string;
  today: string;
  /** Caption for the odd night that begins after this row's iftar (null when none). */
  oddNight: string | null;
  roza: string;
}

/** Shared by the rows and the column header. */
export const TIMETABLE_GRID = "grid-cols-[36px_minmax(0,1fr)_3.5rem_3.5rem]";

/** One roza: round number badge, date and weekday, then the sehri and iftar times. */
export function TimetableRow({
  day,
  state,
  locale,
  labels,
}: {
  day: TimetableDay;
  state: RowState;
  locale: Locale;
  labels: TimetableRowLabels;
}) {
  const [clockFormat] = useClockFormat();
  const odd = oddNightStartingAfter(day.day) !== null;
  const isToday = state === "today";
  const past = state === "past";
  // No day period / AM-PM in the table (sehri is always before dawn, iftar in the evening; a note under the table
  // says so) so the date and the today pill fit on a phone.
  const clock = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return clockParts(h % 24, m, locale, clockFormat).time;
  };
  return (
    <li
      data-state={state}
      data-odd-night={odd || undefined}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        TIMETABLE_GRID,
        "grid items-center gap-x-3 px-4 py-2 print:break-inside-avoid print:bg-white print:text-black",
        isToday && "bg-rp-accent-tint text-rp-ink",
        !isToday && odd && "bg-rp-gold-tint",
        past && !odd && "text-rp-muted",
        !isToday && !odd && !past && "text-rp-ink",
      )}
    >
      <span
        role="img"
        aria-label={labels.roza}
        className={cn(
          "flex size-8 items-center justify-center rounded-rp-full text-[13px] font-semibold leading-none print:bg-transparent print:text-black",
          isToday ? "bg-rp-accent text-white" : odd ? "bg-rp-surface text-rp-gold-text" : "bg-rp-accent-tint text-rp-accent",
        )}
      >
        <span aria-hidden="true">{digits(day.day, locale)}</span>
      </span>
      <p className="rp-row flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate">{formatRowDate(day, labels.weekday, locale)}</span>
        {isToday ? (
          <span className="shrink-0 rounded-rp-full bg-rp-accent px-2 py-0.5 rp-caption font-semibold text-white print:hidden">{labels.today}</span>
        ) : null}
      </p>
      {/* The column header names the times; each keeps an accessible label. */}
      <Time label={labels.sehri} value={clock(day.sehri)} muted={past && !odd} />
      <Time label={labels.iftar} value={clock(day.iftar)} muted={past && !odd} />
      {odd ? (
        <p className={cn("rp-caption col-span-3 col-start-2", "text-rp-gold-text", "print:text-black")}>{labels.oddNight}</p>
      ) : null}
    </li>
  );
}

function Time({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <p className={cn("text-end text-[15px] font-semibold leading-6 tabular-nums", muted && "text-rp-muted", "print:text-black")}>
      <span className="sr-only">{label} </span>
      {value}
    </p>
  );
}
