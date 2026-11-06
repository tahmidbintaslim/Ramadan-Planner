import { useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { toBengaliDigits, type PhaseTimings, type PrayerPhaseResult } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { useClockFormat } from "@/hooks/use-clock-format";
import { joinClockParts } from "@/lib/clock-format";
import { formatRemaining, isBnLocale, prayerClockParts, usePrayerPhase } from "./use-prayer-phase";

export interface PrayerHeroProps {
  /** Today's timings (with tomorrow's fajr), from `timingsFromPrayerTimes`. */
  timings: PhaseTimings;
  /** IANA zone the timings belong to (formats the clock times). */
  timeZone: string;
  /** During Ramadan the after-Isha target reads "সেহরি শেষ" instead of fajr. */
  ramadan?: boolean;
  /** Freeze the clock (tests, previews). */
  now?: Date;
  /**
   * The server's render time (e.g. from the route loader). The server render and the hydrating
   * client render both use it, so phase and minute boundaries cannot cause a hydration mismatch;
   * the live clock takes over right after hydration.
   */
  initialNow?: Date;
  className?: string;
}

const MINUTE_MS = 60_000;

export interface Announcement {
  text: string;
  /** Minute bucket (epoch ms / 60 000, floored) of the last announcement. */
  minute: number;
}

/**
 * Live-region gate: a changed text is announced only in a new clock minute, so screen readers hear
 * at most one update per minute. Comparing buckets (not elapsed ms) keeps interval jitter from
 * pushing an announcement to the following tick.
 */
export function nextAnnouncement(prev: Announcement, text: string, nowMs: number): Announcement {
  const minute = Math.floor(nowMs / MINUTE_MS);
  return text !== prev.text && minute !== prev.minute ? { text, minute } : prev;
}

type Translate = ReturnType<typeof useTranslations>;

/** The hero label for a phase result ("পরবর্তী · আসর", "সেহরি শেষ", "ইফতার"): the live region and progress text. */
export function heroLabel(
  result: PrayerPhaseResult,
  timings: PhaseTimings,
  t: Translate,
  tSalah: Translate,
  ramadan: boolean,
): string {
  const { phase, next } = result;
  switch (phase) {
    case "sehri": {
      // Sehri end is usually the same instant as fajr; only a distinct, passed sehri end reads "next · fajr".
      const distinctSehriEnd = timings.sehriEnd && timings.sehriEnd.getTime() < timings.fajr.getTime();
      if (next.key === "sehri" || !distinctSehriEnd) return t("sehriEnds");
      return t("nextPrayer", { name: tSalah("fajr") });
    }
    case "iftar":
      return t("iftar");
    case "night":
      if (next.key === "isha") return t("nextPrayer", { name: tSalah("isha") });
      // "sehri" only reaches here in Ramadan (see heroResult); without tomorrow's sehri end the target is fajr.
      if (next.key === "sehri") return t("sehriEnds");
      return ramadan ? t("sehriEnds") : t("nextPrayer", { name: tSalah("fajr") });
    case "day":
    default:
      return t("nextPrayer", { name: tSalah(next.key === "sehri" ? "fajr" : next.key) });
  }
}

/**
 * The phase result the hero shows. After isha the engine counts down to tomorrow's sehri end when it is known;
 * outside Ramadan the hero keeps "next · Fajr", so it counts down to tomorrow's fajr instead.
 */
export function heroResult(
  result: PrayerPhaseResult,
  timings: PhaseTimings,
  now: Date,
  ramadan: boolean,
): PrayerPhaseResult {
  if (ramadan || result.phase !== "night" || result.next.key !== "sehri") return result;
  return {
    ...result,
    next: { key: "fajr", at: timings.nextFajr },
    remainingMs: Math.max(0, timings.nextFajr.getTime() - now.getTime()),
  };
}

/** What the card counts towards, for the progress text ("ইফতার পর্যন্ত …"). */
function heroTarget(label: string, result: PrayerPhaseResult, t: Translate, tSalah: Translate): string {
  if (label === t("sehriEnds")) return t("sehri");
  if (result.phase === "iftar") return t("iftar");
  return tSalah(result.next.key === "sehri" ? "fajr" : result.next.key);
}

/** The card's two lines: an eyebrow ("পরবর্তী নামাজ" / "এরপর") and the title (the prayer, "সেহরি শেষ", "ইফতার"). */
export function heroLines(label: string, result: PrayerPhaseResult, t: Translate, tSalah: Translate): { eyebrow: string; title: string } {
  if (label === t("sehriEnds") || result.phase === "iftar") return { eyebrow: t("upNext"), title: label };
  return { eyebrow: t("nextPrayerEyebrow"), title: tSalah(result.next.key === "sehri" ? "fajr" : result.next.key) };
}

/**
 * The next-prayer card (v4): the single teal focal surface, #0E7C6B in both modes, padding 24, radius 24. Top row:
 * the eyebrow and the countdown pill (bg/live-pill) on the trailing edge; the prayer in Title 2; the time in
 * Display L with tabular figures. The day period sits in the reading order of the language: before the time in
 * Bengali ("বিকাল ৪:১৮", founder rule), after it in English ("4:18 PM"). All text is full white (5.10:1).
 */
export function PrayerHero({ timings, timeZone, ramadan = false, now: nowOverride, initialNow, className }: PrayerHeroProps) {
  const t = useTranslations("prayer");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  const { now, phase: result } = usePrayerPhase(timings, timeZone, { now: nowOverride, initialNow });

  // usePrayerPhase only returns null without timings; timings is required here.
  const r = heroResult(result as PrayerPhaseResult, timings, now, ramadan);
  const label = heroLabel(r, timings, t, tSalah, ramadan);
  const { eyebrow, title } = heroLines(label, r, t, tSalah);
  const clock = prayerClockParts(r.next.at, timeZone, locale, clockFormat);
  const time = joinClockParts(clock);
  const remaining = formatRemaining(r.remainingMs, locale);
  const progress = Math.min(1, Math.max(0, r.progress));
  const percent = String(Math.round(progress * 100));
  const progressText = t("progressText", {
    target: heroTarget(label, r, t, tSalah),
    percent: isBnLocale(locale) ? toBengaliDigits(percent) : percent,
  });

  // Screen readers hear the target (label and time) only when it changes, at most once a minute: never the
  // ticking countdown.
  const liveText = `${label} · ${time}`;
  const [announced, setAnnounced] = useState<Announcement>(() => ({
    text: liveText,
    minute: Math.floor(now.getTime() / MINUTE_MS),
  }));
  const nextAnnounced = nextAnnouncement(announced, liveText, now.getTime());
  if (nextAnnounced !== announced) setAnnounced(nextAnnounced);

  const period = clock.period ? (
    <span className="rp-h2" data-testid="hero-period">
      {clock.period}
    </span>
  ) : null;

  return (
    <section
      aria-label={t("heroLabel")}
      data-phase={r.phase}
      className={cn("flex flex-col gap-2 rounded-rp-lg bg-rp-live p-6 text-rp-on-live", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rp-caption">{eyebrow}</span>
        <span className="rp-caption shrink-0 rounded-[14px] bg-rp-live-pill px-3 py-1 tabular-nums" suppressHydrationWarning>
          {remaining}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="rp-greeting">{title}</h2>
        <p className="flex items-baseline gap-2 whitespace-nowrap" data-testid="hero-time" suppressHydrationWarning>
          {clock.periodFirst ? period : null}
          <span className="rp-time-xl">{clock.time}</span>
          {clock.periodFirst ? null : period}
        </p>
      </div>
      <span
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={progressText}
        className="sr-only"
      />
      <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="hero-live">
        {announced.text}
      </p>
    </section>
  );
}
