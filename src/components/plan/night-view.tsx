import { useLocale, useTranslations } from "@/i18n/use-intl";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { CrescentIcon, PinIcon } from "@/components/icons/islamic-icons";
import { HERO_SCRIM_RGB, HERO_RING_SCRIM_ALPHA, HERO_SOURCE_PILL_ALPHA } from "@/components/prayer/prayer-hero";
import { formatPrayerClock } from "@/components/prayer/use-prayer-phase";
import { formatClock, formatRowDate, digits, type Locale } from "@/components/timetable/timetable-logic";
import { cn } from "@/lib/utils";
import { nightProgress, type NightTimes, type OddNightRow } from "./plan-logic";

// The last-ten-nights view (Figma "Last ten nights · 27th night"). PrayerHero is driven by the prayer phase engine
// and cannot show a custom label/time, so the hero here is a night card built from the same parts: the night sky
// gradient, girih lattice, mihrab arch, crescent and stars, the 196px ring and the source pill.

const RING_SIZE = 196;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const scrim = (alpha: number) => `rgba(${HERO_SCRIM_RGB.join(", ")}, ${alpha})`;

type WeekdayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

function Stars() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 40" className="absolute top-14 right-14 h-10 w-16 text-white" fill="currentColor">
      <circle cx="6" cy="10" r="1.2" opacity="0.7" />
      <circle cx="22" cy="30" r="1" opacity="0.5" />
      <circle cx="40" cy="6" r="1.4" opacity="0.8" />
      <circle cx="58" cy="26" r="1" opacity="0.6" />
    </svg>
  );
}

/** Night hero: suggested tahajjud time (start of the night's last third) and the sehri end. */
export function NightHero({
  times,
  now,
  night,
  timeZone,
  location,
  hijriYear,
}: {
  times: NightTimes;
  now: Date;
  night: number;
  timeZone: string;
  location: string;
  hijriYear?: string;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const progress = nightProgress(now, times);
  const percent = Math.round(progress * 100);
  return (
    <section
      aria-label={t("nightHeroAria")}
      data-testid="night-hero"
      data-phase="night"
      className="relative isolate flex min-h-[300px] flex-col overflow-hidden rounded-rp-xl p-5 text-white"
      style={{ backgroundImage: "var(--rp-hero-night)" }}
    >
      <GirihPattern opacity={0.07} className="-z-10 text-white" />
      <MihrabArch className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[300px] w-[300px] max-w-full -translate-x-1/2 text-white" />
      <Stars />
      <CrescentIcon size={28} className="absolute top-14 right-5 text-rp-gold" />

      <div className="flex items-center justify-between gap-3">
        <span className="rp-caption inline-flex min-w-0 items-center gap-1.5 rounded-rp-full bg-white/14 px-3 py-1.5">
          <PinIcon size={16} />
          <span className="truncate">{location}</span>
        </span>
        {hijriYear ? (
          <span className="rp-caption shrink-0 text-white/85">
            {t("hijriNight", { day: digits(night, locale as Locale), year: digits(hijriYear, locale as Locale) })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg aria-hidden="true" focusable="false" width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="-rotate-90">
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R - RING_STROKE / 2} fill={scrim(HERO_RING_SCRIM_ALPHA)} />
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="white" strokeOpacity={0.18} strokeWidth={RING_STROKE} />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              fill="none"
              stroke="var(--rp-accent-gold)"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="rp-small text-white/90">{t("nightHeroLabel")}</span>
            <span className="rp-time-xl tabular-nums" data-testid="tahajjud-time" suppressHydrationWarning>
              {formatPrayerClock(times.tahajjud, timeZone, locale)}
            </span>
            <span className="rp-caption text-white/90" suppressHydrationWarning>
              {t("sehriEndsAt", { time: formatPrayerClock(times.sehriEnd, timeZone, locale) })}
            </span>
          </div>
          <span
            role="progressbar"
            aria-label={t("nightProgress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={t("nightProgressText", { percent: digits(percent, locale as Locale) })}
            className="sr-only"
          />
        </div>
      </div>

      <p className="text-center">
        <span className="rp-caption inline-block rounded-rp-full px-3 py-1 text-white/90" style={{ backgroundColor: scrim(HERO_SOURCE_PILL_ALPHA) }}>
          {t("tahajjudSource")}
        </span>
      </p>
    </section>
  );
}

/** The five odd nights: past muted, tonight gold. Sehri is the night's end (roza N), iftar its start (roza N-1). */
export function OddNightsCard({ rows }: { rows: readonly OddNightRow[] }) {
  const t = useTranslations("plan");
  const tTable = useTranslations("timetablePage");
  const tNav = useTranslations("nav");
  const locale = useLocale() as Locale;
  return (
    <section aria-labelledby="odd-nights-title" className="rounded-rp-lg bg-rp-surface py-1.5 shadow-rp-soft">
      <h2 id="odd-nights-title" className="sr-only">
        {t("oddNightsTitle")}
      </h2>
      <ol className="flex flex-col gap-0.5 px-1.5">
        {rows.map((row) => {
          const tonight = row.state === "tonight";
          const past = row.state === "past";
          return (
            <li
              key={row.night}
              data-night={row.night}
              data-state={row.state}
              aria-current={tonight ? "date" : undefined}
              className={cn(
                "grid grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-rp-md px-3 py-3",
                tonight && "bg-rp-gold-tint text-rp-ink",
                past && "text-rp-muted",
                !tonight && !past && "text-rp-ink",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-rp-full text-[14px] font-semibold leading-none",
                  tonight ? "bg-rp-surface text-rp-gold-text" : past ? "bg-rp-accent-tint text-rp-muted" : "bg-rp-accent-tint text-rp-accent",
                )}
              >
                <span className="sr-only">{t("nightLabel", { n: digits(row.night, locale) })}</span>
                <span aria-hidden="true">{digits(row.night, locale)}</span>
              </span>
              <div className="min-w-0">
                <p className="rp-row">
                  {row.evening ? formatRowDate(row.evening, tNav(`weekdays.${row.evening.weekday}` as `weekdays.${WeekdayKey}`), locale) : t("nightLabel", { n: digits(row.night, locale) })}
                </p>
                {tonight ? <p className="rp-caption text-rp-gold-text">{t("oddNightTonight")}</p> : null}
              </div>
              <NightTime caption={tTable("sehri")} value={row.morning ? formatClock(row.morning.sehri, locale) : "–"} />
              <NightTime caption={tTable("iftar")} value={row.evening ? formatClock(row.evening.iftar, locale) : "–"} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NightTime({ caption, value }: { caption: string; value: string }) {
  return (
    <div className="min-w-[3.25rem] text-end">
      <p className="rp-caption text-rp-muted">{caption}</p>
      <p className="text-[16px] leading-6 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** The Laylat al-Qadr dua (Tirmidhi 3513): Arabic, transliteration and meaning, with its source. */
export const QADR_DUA_ARABIC = "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي";

export function QadrDuaCard() {
  const t = useTranslations("plan");
  return (
    <section aria-labelledby="qadr-dua-title" data-testid="qadr-dua" className="flex flex-col gap-2 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft">
      <h2 id="qadr-dua-title" className="rp-row font-semibold">
        {t("items.qadrDua")}
      </h2>
      <p lang="ar" dir="rtl" className="text-[22px] leading-[40px]">
        {QADR_DUA_ARABIC}
      </p>
      <p className="rp-small italic text-rp-ink">{t("qadrDuaTranslit")}</p>
      <p className="rp-small text-rp-ink">{t("qadrDuaMeaning")}</p>
      <p className="rp-caption text-rp-muted">{t("qadrDuaSource")}</p>
    </section>
  );
}
