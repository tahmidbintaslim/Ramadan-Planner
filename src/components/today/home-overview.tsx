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
import { DailyAyahCard } from "./daily-ayah-card";
import { FeatureTiles, PhaseCard, PlanPreview, SupportCard, phaseCardKind, type PlanPreviewState } from "./home-sections";

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
  ramadan: RamadanStatus | null;
  now: Date;
  initialNow?: Date;
  /** Freeze the hero/list clocks (tests). */
  frozenNow?: Date;
  reminders: Partial<Record<FivePrayer, boolean>>;
  onToggleReminder?: (prayer: FivePrayer, enabled: boolean) => void;
  plan: PlanPreviewState;
  sadaqahDismissedAt: Date | null;
  onDismissSadaqah: () => void;
  onRetry?: () => void;
}

/**
 * The Today overview (v4, Figma page 10).
 * Compact / medium (one column, DOM order): next-prayer card, Sehri/Iftar pair, today's prayers with the source
 * line, then the one contextual card (niyyah / iftar dua, else the day's ayah), today's amal, companions, support.
 * All five prayers clear the tab bar at 390x844.
 * Regular (>=835px): the large title with the place, date and Hijri date, then two columns: left = card, pair and
 * prayers; right = today's amal and the ayah (or phase card), companions, support. The column wrappers are
 * `display: contents` below 835px and `order` restores the compact sequence there.
 */
export function HomeOverview({
  status,
  timings,
  phaseTimings,
  tomorrowTimings,
  cached,
  districtLabel,
  ramadan,
  now,
  initialNow,
  frozenNow,
  reminders,
  onToggleReminder,
  plan,
  sadaqahDismissedAt,
  onDismissSadaqah,
  onRetry,
}: HomeOverviewProps) {
  const t = useTranslations("home");
  const tToday = useTranslations("today");
  const tPrayer = useTranslations("prayer");
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
  const sourceLine = knownSource ? tPrayer("source", { source }) : tPrayer("sampleSource", { source });
  const place = districtLabel ?? (timings ? districtOf(timings.location) : undefined);
  const hijri = timings ? hijriLabelOf(timings, locale, (v) => t("hijri", v)) : undefined;
  const subtitle = [place, longDateOf(now, timeZone, locale), hijri].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      {/* Large Title (regular); below 835px the header carries the place and date, so the title is read only. */}
      <div className="sr-only regular:not-sr-only regular:flex regular:flex-col regular:gap-1">
        <h1 className="rp-large-title text-rp-ink">{tToday("title")}</h1>
        <p className="rp-small text-rp-muted" data-testid="today-subtitle" suppressHydrationWarning>
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col gap-6 regular:grid regular:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)] regular:items-start regular:gap-6">
        <div className="contents regular:flex regular:flex-col regular:gap-6">
          {timings && phaseTimings ? (
            <div className="order-1 flex flex-col gap-4">
              <PrayerHero timings={phaseTimings} timeZone={timeZone} ramadan={inRamadan} now={frozenNow} initialNow={initialNow} />
              <SehriIftarPair
                timings={pairTomorrow ?? phaseTimings}
                timeZone={timeZone}
                dayLabel={pairTomorrow ? t("tomorrow") : undefined}
              />
            </div>
          ) : status === "error" ? (
            <div role="alert" className="order-1 flex flex-col items-start gap-3 rounded-rp-md bg-rp-surface p-5 text-rp-ink">
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
              className="order-1 flex min-h-[272px] items-end justify-center rounded-rp-lg bg-rp-accent-tint p-6 motion-safe:animate-pulse"
            >
              <span className="rp-small text-rp-muted">{t("timingsLoading")}</span>
            </div>
          )}
          {phaseTimings ? (
            <PrayerList
              className="order-2"
              timings={phaseTimings}
              timeZone={timeZone}
              reminders={reminders}
              onToggleReminder={onToggleReminder}
              source={sourceLine}
              now={frozenNow}
              initialNow={initialNow}
            />
          ) : null}
        </div>

        <div className="contents regular:flex regular:flex-col regular:gap-8">
          {timings && phaseTimings ? (
            cardKind ? (
              <PhaseCard className="order-3 regular:order-2" kind={cardKind} />
            ) : (
              <DailyAyahCard className="order-3 regular:order-2" ramadanDay={ramadanDay} />
            )
          ) : null}
          <PlanPreview className="order-4 regular:order-1" state={plan} />
          <FeatureTiles className="order-5 regular:order-3" />
          {showSupport ? (
            <SupportCard
              className="order-6 regular:order-4"
              lastTen={ramadanDay !== null && ramadanDay >= LAST_TEN_FROM_DAY}
              onDismiss={onDismissSadaqah}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** "শনিবার, ২০ ফেব্রুয়ারি ২০২৭" / "Saturday, 20 February 2027" in the timings' zone. */
export function longDateOf(now: Date, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(isBnLocale(locale) ? "bn-BD" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone,
    }).format(now);
  } catch {
    return "";
  }
}
