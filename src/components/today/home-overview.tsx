import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { PrayerHero } from "@/components/prayer/prayer-hero";
import { SehriIftarPair } from "@/components/prayer/sehri-iftar-pair";
import { PrayerList } from "@/components/prayer/prayer-list";
import { isBnLocale, type FivePrayer } from "@/components/prayer/use-prayer-phase";
import type { TimingData } from "@/types/database";
import type { RamadanStatus } from "@/lib/ramadan-date";
import {
  LAST_TEN_FROM_DAY,
  getPrayerPhase,
  shouldShowSadaqah,
  toBengaliDigits,
  type PhaseTimings,
} from "@/lib/prayer-phase";
import { FeatureTiles, PhaseCard, PlanPreview, SupportCard, phaseCardKind } from "./home-sections";
import type { DailyChecklistState } from "./use-daily-checklist";

/** Ramadan day (1-30) from the Ramadan status, or null outside Ramadan. */
export function ramadanDayOf(status: RamadanStatus | null | undefined): number | null {
  if (status?.phase !== "ramadan") return null;
  const d = status.currentDay;
  return typeof d === "number" && d >= 1 && d <= 30 ? d : null;
}

/** Eid al-Fitr (1-3 Shawwal) or Eid al-Adha (10-13 Dhul Hijjah), from the Hijri date in the Ramadan status. */
export function isEidOf(status: RamadanStatus | null | undefined): boolean {
  if (!status) return false;
  const day = Number.parseInt(status.hijriDay, 10);
  if (!Number.isFinite(day)) return false;
  if (status.hijriMonth === 10) return day >= 1 && day <= 3;
  if (status.hijriMonth === 12) return day >= 10 && day <= 13;
  return false;
}

/** "১২ রমজান ১৪৪৮" (bn) / "12 Ramadan 1448" (en), or undefined when the timings carry no Hijri date. */
export function hijriLabelOf(timings: TimingData, locale: string, format: (v: Record<string, string>) => string) {
  const h = timings.hijriDate;
  if (!h?.day || !h.year) return undefined;
  const bn = isBnLocale(locale);
  const month = bn ? h.monthBn || h.month : h.month.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const digits = (s: string) => (bn ? toBengaliDigits(String(Number(s) || s)) : String(Number(s) || s));
  return format({ day: digits(h.day), month, year: digits(h.year) });
}

/** District for the hero's location pill: the first part of the API's label ("ঢাকা, বাংলাদেশ" → "ঢাকা"). */
export function districtOf(location: string): string {
  return location.split(",")[0]?.trim() || location;
}

export interface HomeOverviewProps {
  status: "loading" | "ready" | "error";
  timings: TimingData | null;
  phaseTimings: PhaseTimings | null;
  /** Tomorrow's fajr, sehri end and maghrib: after Isha in Ramadan the Sehri/Iftar pair shows them. */
  tomorrowTimings?: Pick<PhaseTimings, "fajr" | "maghrib" | "sehriEnd"> | null;
  /** Timings came from the offline cache rather than a fresh answer. */
  cached: boolean;
  /** The district chosen at onboarding; wins over the API's location label. */
  districtLabel?: string;
  /** Where the hero's location pill leads (change the district). */
  locationHref?: string;
  ramadan: RamadanStatus | null;
  now: Date;
  initialNow?: Date;
  /** Freeze the hero/list clocks (tests). */
  frozenNow?: Date;
  reminders: Partial<Record<FivePrayer, boolean>>;
  onToggleReminder?: (prayer: FivePrayer, enabled: boolean) => void;
  checklist: DailyChecklistState;
  sadaqahDismissedAt: Date | null;
  onDismissSadaqah: () => void;
  onRetry?: () => void;
}

/**
 * The Home overview. Mobile (one column, DOM order): hero, Sehri/Iftar pair, phase card, prayers, companion tiles,
 * today's plan, support. From 1024px: two columns, as in the Figma Web/Tablet frame: left = hero, pair, phase card,
 * tiles; right = prayers, plan, support. The column wrappers are `display: contents` below 1024px and `order`
 * restores the mobile sequence there.
 */
export function HomeOverview({
  status,
  timings,
  phaseTimings,
  tomorrowTimings,
  cached,
  districtLabel,
  locationHref,
  ramadan,
  now,
  initialNow,
  frozenNow,
  reminders,
  onToggleReminder,
  checklist,
  sadaqahDismissedAt,
  onDismissSadaqah,
  onRetry,
}: HomeOverviewProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const ramadanDay = ramadanDayOf(ramadan);
  const inRamadan = ramadanDay !== null;
  const phase = phaseTimings ? getPrayerPhase(now, phaseTimings).phase : null;
  const cardKind = phaseCardKind(now, phase, phaseTimings, inRamadan);
  // After Isha in Ramadan the next fast is tomorrow's: the pair shows its sehri and iftar.
  const pairTomorrow =
    inRamadan && phaseTimings && tomorrowTimings && now.getTime() >= phaseTimings.isha.getTime() ? tomorrowTimings : null;
  const showSupport =
    phaseTimings !== null &&
    shouldShowSadaqah(now, phaseTimings, { ramadanDay, isEid: isEidOf(ramadan), dismissedAt: sadaqahDismissedAt });

  const timeZone = timings?.timezone ?? "Asia/Dhaka";
  const knownSource = !cached && timings?.source;
  const source = knownSource
    ? t(timings.source === "islamicapi" ? "sourceIslamicApi" : "sourceAladhan")
    : t("sourceUnverified");

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        {timings && phaseTimings ? (
          <>
            <PrayerHero
              className="order-1"
              timings={phaseTimings}
              timeZone={timeZone}
              district={districtLabel ?? districtOf(timings.location)}
              locationHref={locationHref}
              hijriLabel={hijriLabelOf(timings, locale, (v) => t("hijri", v))}
              source={source}
              sample={!knownSource}
              ramadan={inRamadan}
              now={frozenNow}
              initialNow={initialNow}
            />
            <SehriIftarPair
              className="order-2"
              timings={pairTomorrow ?? phaseTimings}
              timeZone={timeZone}
              dayLabel={pairTomorrow ? t("tomorrow") : undefined}
            />
            {cardKind ? <PhaseCard className="order-3" kind={cardKind} /> : null}
          </>
        ) : status === "error" ? (
          <div
            role="alert"
            className="order-1 flex flex-col items-start gap-3 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft"
          >
            <p className="rp-body">{t("timingsError")}</p>
            {onRetry ? (
              <Button variant="soft" onClick={onRetry}>
                {t("retry")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div
            data-testid="hero-skeleton"
            role="status"
            className="order-1 flex min-h-[300px] items-end justify-center rounded-rp-xl bg-rp-accent-tint p-5 motion-safe:animate-pulse"
          >
            <span className="rp-small text-rp-muted">{t("timingsLoading")}</span>
          </div>
        )}
        <FeatureTiles className="order-5 lg:mt-2" />
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-6">
        {phaseTimings ? (
          <PrayerList
            className="order-4"
            timings={phaseTimings}
            timeZone={timeZone}
            reminders={reminders}
            onToggleReminder={onToggleReminder}
            now={frozenNow}
            initialNow={initialNow}
          />
        ) : null}
        <PlanPreview className="order-6" state={checklist} />
        {showSupport ? (
          <SupportCard
            className="order-7"
            lastTen={ramadanDay !== null && ramadanDay >= LAST_TEN_FROM_DAY}
            onDismiss={onDismissSadaqah}
          />
        ) : null}
      </div>
    </div>
  );
}
