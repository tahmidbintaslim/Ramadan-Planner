import { useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { CrescentIcon, PinIcon } from "@/components/icons/islamic-icons";
import type { PhaseTimings, PrayerPhase, PrayerPhaseResult } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { formatPrayerClock, formatRemaining, usePrayerPhase } from "./use-prayer-phase";

export interface PrayerHeroProps {
  /** Today's timings (with tomorrow's fajr), from `timingsFromPrayerTimes`. */
  timings: PhaseTimings;
  /** IANA zone the timings belong to (formats the clock times). */
  timeZone: string;
  /** District / city name for the location pill. */
  district: string;
  /** Pre-formatted Hijri date, e.g. "১২ রমযান ১৪৪৮". */
  hijriLabel?: string;
  /** Where the times come from, e.g. "ইসলামিক ফাউন্ডেশন". Always shown. */
  source: string;
  /** Sample / unverified times: the source line is prefixed with "নমুনা সময়". */
  sample?: boolean;
  /** During Ramadan the after-Isha target reads "সেহরি শেষ" instead of "পরবর্তী · ফজর". */
  ramadan?: boolean;
  /** Freeze the clock (tests, previews). */
  now?: Date;
  className?: string;
}

const GRADIENT: Record<PrayerPhase, string> = {
  sehri: "var(--rp-hero-sehri)",
  day: "var(--rp-hero-day)",
  iftar: "var(--rp-hero-iftar)",
  night: "var(--rp-hero-night)",
};

const RING_SIZE = 196;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const ANNOUNCE_EVERY_MS = 60_000;

/**
 * Contrast backdrops (gradients stay as designed). The day and iftar skies get light towards the
 * bottom (#4FBFA5 / #D9B46C), where white text falls below 4.5:1, so the ring text sits on a faint
 * ink disc and the source line on an ink pill. Values are checked in prayer-hero.contrast.test.ts.
 */
export const HERO_SCRIM_RGB = [8, 26, 30] as const;
export const HERO_RING_SCRIM_ALPHA = 0.35;
export const HERO_SOURCE_PILL_ALPHA = 0.5;
const scrim = (alpha: number) => `rgba(${HERO_SCRIM_RGB.join(", ")}, ${alpha})`;

type Translate = ReturnType<typeof useTranslations>;

/** The hero label for a phase result (see the Figma spec, "Labels per phase"). */
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
      if (next.key === "isha") return tSalah("isha");
      return ramadan ? t("sehriEnds") : t("nextPrayer", { name: tSalah("fajr") });
    case "day":
    default:
      return t("nextPrayer", { name: tSalah(next.key === "sehri" ? "fajr" : next.key) });
  }
}

function Stars() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 40"
      className="absolute top-14 right-14 h-10 w-16 text-white"
      fill="currentColor"
    >
      <circle cx="6" cy="10" r="1.2" opacity="0.7" />
      <circle cx="22" cy="30" r="1" opacity="0.5" />
      <circle cx="40" cy="6" r="1.4" opacity="0.8" />
      <circle cx="58" cy="26" r="1" opacity="0.6" />
    </svg>
  );
}

export function PrayerHero({
  timings,
  timeZone,
  district,
  hijriLabel,
  source,
  sample = false,
  ramadan = false,
  now: nowOverride,
  className,
}: PrayerHeroProps) {
  const t = useTranslations("prayer");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const { now, phase: result } = usePrayerPhase(timings, timeZone, { now: nowOverride });

  // usePrayerPhase only returns null without timings; timings is required here.
  const r = result as PrayerPhaseResult;
  const label = heroLabel(r, timings, t, tSalah, ramadan);
  const time = formatPrayerClock(r.next.at, timeZone, locale);
  const remaining = formatRemaining(r.remainingMs, locale);
  const progress = Math.min(1, Math.max(0, r.progress));
  const nightSky = r.phase === "sehri" || r.phase === "night";
  const sourceLine = sample ? t("sampleSource", { source }) : t("source", { source });

  // Screen readers hear the countdown at most once a minute (the clock ticks every 30 s).
  const liveText = t("liveRemaining", { label, time, remaining });
  // State adjusted during render (no effect): React re-renders once with the new announcement.
  const [announced, setAnnounced] = useState(() => ({ text: liveText, at: now.getTime() }));
  if (liveText !== announced.text && now.getTime() - announced.at >= ANNOUNCE_EVERY_MS) {
    setAnnounced({ text: liveText, at: now.getTime() });
  }

  return (
    <section
      aria-label={t("heroLabel")}
      data-phase={r.phase}
      className={cn(
        "relative isolate flex min-h-[300px] flex-col overflow-hidden rounded-rp-xl p-5 text-white",
        className,
      )}
      style={{ backgroundImage: GRADIENT[r.phase] }}
    >
      <GirihPattern opacity={0.07} className="-z-10 text-white" />
      <MihrabArch className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[300px] w-[300px] max-w-full -translate-x-1/2 text-white" />
      {nightSky ? (
        <>
          <Stars />
          <CrescentIcon
            data-testid="hero-crescent"
            size={28}
            className="absolute top-14 right-5 text-rp-gold"
          />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <span className="rp-caption inline-flex min-w-0 items-center gap-1.5 rounded-rp-full bg-white/14 px-3 py-1.5">
          <PinIcon size={16} />
          <span className="truncate">{district}</span>
        </span>
        {hijriLabel ? <span className="rp-caption shrink-0 text-white/85">{hijriLabel}</span> : null}
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg
            aria-hidden="true"
            focusable="false"
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="-rotate-90"
          >
            <circle
              data-testid="hero-ring-scrim"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R - RING_STROKE / 2}
              fill={scrim(HERO_RING_SCRIM_ALPHA)}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              fill="none"
              stroke="white"
              strokeOpacity={0.18}
              strokeWidth={RING_STROKE}
            />
            <circle
              data-testid="hero-ring-progress"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              fill="none"
              stroke={r.phase === "iftar" ? "white" : "var(--rp-accent-gold)"}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="rp-small text-white/90">{label}</span>
            <span className="rp-time-xl tabular-nums" suppressHydrationWarning>
              {time}
            </span>
            <span className="rp-caption text-white/90" suppressHydrationWarning>
              {remaining}
            </span>
          </div>
          <span
            role="progressbar"
            aria-label={t("progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="sr-only"
          />
        </div>
      </div>

      <p className="text-center">
        <span
          data-testid="hero-source"
          className="rp-caption inline-block rounded-rp-full px-3 py-1 text-white/90"
          style={{ backgroundColor: scrim(HERO_SOURCE_PILL_ALPHA) }}
        >
          {sourceLine}
        </span>
      </p>
      <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="hero-live">
        {announced.text}
      </p>
    </section>
  );
}
