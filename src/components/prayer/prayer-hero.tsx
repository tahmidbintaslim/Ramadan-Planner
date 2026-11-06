import { useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { CrescentIcon, PinIcon } from "@/components/icons/islamic-icons";
import { toBengaliDigits, type PhaseTimings, type PrayerPhase, type PrayerPhaseResult } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { Link } from "@/components/shared/link";
import { useClockFormat } from "@/hooks/use-clock-format";
import { joinClockParts } from "@/lib/clock-format";
import { ClockTime } from "./clock-time";
import { formatRemaining, isBnLocale, prayerClockParts, usePrayerPhase } from "./use-prayer-phase";

export interface PrayerHeroProps {
  /** Today's timings (with tomorrow's fajr), from `timingsFromPrayerTimes`. */
  timings: PhaseTimings;
  /** IANA zone the timings belong to (formats the clock times). */
  timeZone: string;
  /** District / city name for the location pill. */
  district: string;
  /** When set, the location pill is a link there (to change the district). */
  locationHref?: string;
  /** Pre-formatted Hijri date, e.g. "১২ রমজান ১৪৪৮". */
  hijriLabel?: string;
  /** Where the times come from, e.g. "ইসলামিক ফাউন্ডেশন". Always shown. */
  source: string;
  /** Sample / unverified times: the source line is prefixed with "নমুনা সময়". */
  sample?: boolean;
  /** During Ramadan the after-Isha target reads "সেহরি শেষ" instead of "পরবর্তী · ফজর". */
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

const GRADIENT: Record<PrayerPhase, string> = {
  sehri: "var(--rp-hero-sehri)",
  day: "var(--rp-hero-day)",
  iftar: "var(--rp-hero-iftar)",
  night: "var(--rp-hero-night)",
};

// The ring geometry (viewBox units): drawn at 92px on phones and 184px from 1024px.
const RING_SIZE = 184;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
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

/** What the ring counts towards, for the progressbar's aria-valuetext ("ইফতার পর্যন্ত …"). */
function heroTarget(label: string, result: PrayerPhaseResult, t: Translate, tSalah: Translate): string {
  if (label === t("sehriEnds")) return t("sehri");
  if (result.phase === "iftar") return t("iftar");
  return tSalah(result.next.key === "sehri" ? "fajr" : result.next.key);
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
  locationHref,
  hijriLabel,
  source,
  sample = false,
  ramadan = false,
  now: nowOverride,
  initialNow,
  className,
}: PrayerHeroProps) {
  const t = useTranslations("prayer");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  const { now, phase: result } = usePrayerPhase(timings, timeZone, { now: nowOverride, initialNow });

  // usePrayerPhase only returns null without timings; timings is required here.
  const r = heroResult(result as PrayerPhaseResult, timings, now, ramadan);
  const label = heroLabel(r, timings, t, tSalah, ramadan);
  const clock = prayerClockParts(r.next.at, timeZone, locale, clockFormat);
  const time = joinClockParts(clock);
  const remaining = formatRemaining(r.remainingMs, locale);
  const progress = Math.min(1, Math.max(0, r.progress));
  const nightSky = r.phase === "sehri" || r.phase === "night";
  const percent = String(Math.round(progress * 100));
  const progressText = t("progressText", {
    target: heroTarget(label, r, t, tSalah),
    percent: isBnLocale(locale) ? toBengaliDigits(percent) : percent,
  });
  const sourceLine = sample ? t("sampleSource", { source }) : t("source", { source });

  // Screen readers hear the countdown at most once a minute (the clock ticks every 30 s).
  // Screen readers hear the target (label and time) only when it changes, at most once a minute: never the
  // ticking countdown.
  const liveText = `${label} · ${time}`;
  const [announced, setAnnounced] = useState<Announcement>(() => ({
    text: liveText,
    minute: Math.floor(now.getTime() / MINUTE_MS),
  }));
  const nextAnnounced = nextAnnouncement(announced, liveText, now.getTime());
  if (nextAnnounced !== announced) setAnnounced(nextAnnounced);

  return (
    <section
      aria-label={t("heroLabel")}
      data-phase={r.phase}
      className={cn(
        // Mobile: a compact card (about 240px) where the prayer name and time lead and a small ring shows progress;
        // from 1024px the large centred ring with the time inside it.
        "relative isolate flex flex-col overflow-hidden rounded-rp-xl p-4 text-white lg:min-h-[300px] lg:p-5",
        className,
      )}
      style={{ backgroundImage: GRADIENT[r.phase] }}
    >
      <GirihPattern opacity={0.07} className="-z-10 text-white" />
      <MihrabArch className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[220px] w-[220px] max-w-full -translate-x-1/2 text-white lg:h-[300px] lg:w-[300px]" />
      {nightSky ? (
        <>
          <Stars />
          <CrescentIcon
            data-testid="hero-crescent"
            size={28}
            className="absolute top-14 right-5 hidden text-rp-gold lg:block"
          />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {locationHref ? (
          <Link
            href={locationHref}
            data-testid="hero-location"
            aria-label={t("locationChange", { district })}
            className="rp-caption inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-rp-full bg-white/14 px-4 py-2 outline-none transition-colors hover:bg-white/22 focus-visible:ring-[3px] focus-visible:ring-white/70"
          >
            <PinIcon size={16} />
            <span aria-hidden="true" className="truncate">
              {district}
            </span>
          </Link>
        ) : (
          <span data-testid="hero-location" className="rp-caption inline-flex min-w-0 items-center gap-1.5 rounded-rp-full bg-white/14 px-3 py-1.5">
            <PinIcon size={16} />
            <span className="sr-only">{t("location", { district })}</span>
            <span aria-hidden="true" className="truncate">
              {district}
            </span>
          </span>
        )}
        {hijriLabel ? <span className="rp-caption shrink-0 text-white/85">{hijriLabel}</span> : null}
      </div>

      <div className="relative flex flex-1 items-center justify-between gap-3 py-2 lg:justify-center lg:py-4">
        <div className="flex min-w-0 flex-col lg:absolute lg:inset-0 lg:items-center lg:justify-center lg:text-center">
          <span className="rp-row font-semibold text-white lg:text-[14px] lg:leading-[22px] lg:font-normal lg:text-white/90">{label}</span>
          {/* Phone: the day period sits on the time's line. Inside the desktop ring it gets its own line above the
              time, so "বিকাল ৪:১৮" never runs into the ring. */}
          <span className="rp-time-xl hidden whitespace-nowrap tabular-nums max-lg:inline" suppressHydrationWarning>
            <ClockTime parts={clock} />
          </span>
          <span className="hidden flex-col items-center lg:flex" suppressHydrationWarning>
            {clock.period ? <span className="rp-row">{clock.period}</span> : null}
            <span className="rp-time-xl whitespace-nowrap tabular-nums">{clock.time}</span>
          </span>
          <span className="rp-caption tabular-nums text-white/90" suppressHydrationWarning>
            {remaining}
          </span>
        </div>
        <div className="relative size-[92px] shrink-0 lg:size-[184px]">
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="size-full -rotate-90"
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
          {/* Phone: the ring's centre carries a quiet crescent at night, the percent by day. */}
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center lg:hidden">
            {nightSky ? (
              <CrescentIcon size={28} className="text-rp-gold" />
            ) : (
              <span className="rp-caption tabular-nums text-white/90">{isBnLocale(locale) ? toBengaliDigits(percent) : percent}%</span>
            )}
          </span>
          <span
            role="progressbar"
            aria-label={t("progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={progressText}
            className="sr-only"
          />
        </div>
      </div>

      <p className="text-center">
        <span
          data-testid="hero-source"
          className="rp-caption inline-block rounded-rp-full px-3 py-0.5 text-white/90"
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
