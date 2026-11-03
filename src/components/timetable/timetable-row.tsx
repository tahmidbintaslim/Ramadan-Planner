import { cn } from "@/lib/utils";
import type { TimetableDay } from "@/lib/ramadan-timetable";
import { oddNightStartingAfter } from "@/lib/ramadan-nights";
import { type Locale, type RowState, digits, formatClock, formatRowDate } from "./timetable-logic";

export interface TimetableRowLabels {
  weekday: string;
  sehri: string;
  iftar: string;
  today: string;
  /** Caption for the odd night that begins after this row's iftar (null when none). */
  oddNight: string | null;
  roza: string;
}

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
  const odd = oddNightStartingAfter(day.day) !== null;
  const isToday = state === "today";
  const past = state === "past";
  return (
    <li
      data-state={state}
      data-odd-night={odd || undefined}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "grid grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-3 print:break-inside-avoid print:bg-white print:text-black",
        isToday && "bg-rp-live text-rp-on-live",
        !isToday && odd && "bg-rp-gold-tint",
        past && !odd && "text-rp-muted",
        !isToday && !odd && !past && "text-rp-ink",
      )}
    >
      <span
        role="img"
        aria-label={labels.roza}
        className={cn(
          "flex size-9 items-center justify-center rounded-rp-full text-[14px] font-semibold leading-none print:bg-transparent print:text-black",
          isToday ? "bg-rp-surface text-rp-accent" : odd ? "bg-rp-surface text-rp-gold-text" : "bg-rp-accent-tint text-rp-accent",
        )}
      >
        <span aria-hidden="true">{digits(day.day, locale)}</span>
      </span>
      <div className="min-w-0">
        <p className="rp-row">
          {formatRowDate(day, labels.weekday, locale)}
          {isToday ? (
            <span className="ms-2 rounded-rp-full bg-rp-surface px-2 py-0.5 text-[12px] font-semibold text-rp-accent print:hidden">{labels.today}</span>
          ) : null}
        </p>
      </div>
      <Time caption={labels.sehri} value={formatClock(day.sehri, locale)} tone={isToday ? "live" : "default"} muted={past && !odd} />
      <Time caption={labels.iftar} value={formatClock(day.iftar, locale)} tone={isToday ? "live" : "default"} muted={past && !odd} />
      {odd ? (
        <p
          className={cn(
            "rp-caption col-span-3 col-start-2 mt-1",
            isToday ? "text-rp-on-live" : "text-rp-gold-text",
            "print:text-black",
          )}
        >
          {labels.oddNight}
        </p>
      ) : null}
    </li>
  );
}

function Time({ caption, value, tone, muted }: { caption: string; value: string; tone: "live" | "default"; muted: boolean }) {
  return (
    <div className="min-w-[3.75rem] text-end">
      <p className={cn("rp-caption", tone === "live" ? "text-rp-on-live" : "text-rp-muted", "print:text-black")}>{caption}</p>
      <p className={cn("text-[16px] font-semibold leading-6 tabular-nums", muted && "text-rp-muted", "print:text-black")}>{value}</p>
    </div>
  );
}
