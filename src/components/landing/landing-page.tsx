import { useState, useSyncExternalStore, type ComponentType } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import { CrescentIcon, DatesIcon, SalahTimeIcon, type IconProps } from "@/components/icons/islamic-icons";
import { BrandLockup, SiteHeader } from "@/components/layout/site-header";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { PrayerHero, heroLabel, heroResult } from "@/components/prayer/prayer-hero";
import { SehriIftarPair } from "@/components/prayer/sehri-iftar-pair";
import { PrayerList } from "@/components/prayer/prayer-list";
import { formatPrayerClock } from "@/components/prayer/use-prayer-phase";
import { LocationSheet } from "@/components/onboarding/location-sheet";
import { useDistrictLabel } from "@/components/layout/app-header";
import { useLiveTimes } from "@/components/today/use-live-times";
import { districtOf, hijriLabelOf } from "@/components/today/home-overview";
import { useClockFormat } from "@/hooks/use-clock-format";
import { useStoredLocation } from "@/hooks/use-stored-location";
import { getPrayerPhase, type PhaseTimings } from "@/lib/prayer-phase";
import { needsOnboarding, subscribeStoredLocation } from "@/lib/user-location";
import { cn } from "@/lib/utils";
import { DEFAULT_DISTRICT_ID, districtById, districtName } from "@/lib/districts";

/**
 * Where "Get started" leads: onboarding for a first-time guest, straight to Today otherwise. The server (and
 * the hydrating render) link to onboarding; the device's choice is read after mount and followed on every save.
 */
function useStartHref(): string {
  const { user } = useAuth();
  const onboard = useSyncExternalStore(
    subscribeStoredLocation,
    () => needsOnboarding(user !== null),
    () => true,
  );
  return onboard ? "/welcome" : "/today";
}

const noSubscribe = () => () => {};

/**
 * The copyright year: the server's year (from the route loader, so the hydrating render matches the HTML), then
 * the device's year after mount.
 */
export function useFooterYear(serverYear: number): number {
  return useSyncExternalStore(noSubscribe, () => new Date().getFullYear(), () => serverYear);
}

function TimeRow({ Icon, label, time, next }: { Icon: ComponentType<IconProps>; label: string; time: string; next?: boolean }) {
  return (
    <li className={cn("flex min-h-12 items-center gap-3 rounded-rp-input px-3", next && "bg-rp-accent-tint")}>
      <Icon size={24} className="shrink-0 text-rp-icon" />
      <span className="rp-row min-w-0 flex-1 truncate">{label}</span>
      <span className="rp-headline whitespace-nowrap tabular-nums" suppressHydrationWarning>
        {time}
      </span>
    </li>
  );
}

/** Compact "Today in Dhaka" card (welcome value screen): sehri end, the next prayer (tinted) and iftar. */
function TodayCard({ timings, timeZone, now, title, hijri }: { timings: PhaseTimings; timeZone: string; now: Date; title: string; hijri?: string }) {
  const t = useTranslations("prayer");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  const r = heroResult(getPrayerPhase(now, timings), timings, now, false);
  const sehriEnd = timings.sehriEnd && timings.sehriEnd.getTime() < timings.fajr.getTime() ? timings.sehriEnd : timings.fajr;
  const clock = (at: Date) => formatPrayerClock(at, timeZone, locale, clockFormat);
  return (
    <section aria-labelledby="landing-today" data-testid="landing-sample" className="rounded-rp-lg bg-rp-surface p-2 text-rp-ink">
      <div className="flex items-baseline justify-between gap-3 px-3 pt-2 pb-1">
        <h2 id="landing-today" className="rp-headline">
          {title}
        </h2>
        {hijri ? <span className="rp-caption text-rp-muted">{hijri}</span> : null}
      </div>
      <ul className="flex flex-col">
        <TimeRow Icon={CrescentIcon} label={t("sehriEnds")} time={clock(sehriEnd)} />
        <TimeRow Icon={SalahTimeIcon} label={heroLabel(r, timings, t, tSalah, false)} time={clock(r.next.at)} next />
        <TimeRow Icon={DatesIcon} label={t("iftar")} time={clock(timings.maghrib)} />
      </ul>
    </section>
  );
}

/**
 * The web homepage = the app's welcome (Figma page 10).
 * Compact (<=430): the welcome value screen: a teal band with the brand, the title and the line, then today's real
 * times for the visitor's district (Dhaka until one is chosen) and "Get started" in the lower part of the screen.
 * Medium / regular: the homepage header (brand, বাংলা | English, Text & Theme), the copy and the two actions on
 * the left, and the next-prayer card, Sehri/Iftar pair and today's prayers on the right, in a 1200 column.
 * Every time is live from /api/timings (no sample times); until they arrive a quiet placeholder holds the space.
 */
export function LandingPage({ serverYear = new Date().getFullYear(), initialNow }: { serverYear?: number; initialNow?: Date }) {
  const t = useTranslations("landing");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const tPrayer = useTranslations("prayer");
  const locale = useLocale();
  const startHref = useStartHref();
  const year = useFooterYear(serverYear);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { home, phaseTimings, timeZone, now } = useLiveTimes(initialNow);
  const chosen = useDistrictLabel();
  const timings = home.timings;
  // The chosen district, else Dhaka (the times' fallback) in the UI language; a device position outside the
  // districts takes the API's label.
  const stored = useStoredLocation();
  const place =
    chosen ??
    (stored && timings ? districtOf(timings.location) : districtName(districtById(DEFAULT_DISTRICT_ID)!, locale));
  const hijri = timings ? hijriLabelOf(timings, locale, (v) => tHome("hijri", v)) : undefined;
  const fresh = !home.cached && timings?.source;
  const source = tPrayer(fresh ? "source" : "sampleSource", {
    source: fresh ? tHome(timings.source === "islamicapi" ? "sourceIslamicApi" : "sourceAladhan") : tHome("sourceUnverified"),
  });
  const weekday = (() => {
    try {
      return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long", timeZone }).format(now);
    } catch {
      return "";
    }
  })();
  const dateLine = [weekday, hijri, place].filter(Boolean).join(" · ");

  const placeholder = (
    <div
      role="status"
      className="flex min-h-[176px] items-end rounded-rp-lg bg-rp-surface p-6 text-rp-muted motion-safe:animate-pulse"
    >
      <span className="rp-small">{home.status === "error" ? t("timesUnavailable") : t("timesLoading")}</span>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-rp-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-rp-sm focus:bg-rp-surface focus:px-3 focus:py-2 focus:shadow"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader className="hidden medium:block" />

      <main
        id="main-content"
        className="mx-auto flex min-h-dvh w-full max-w-[1296px] flex-1 flex-col medium:min-h-0 medium:px-6 medium:py-12 regular:grid regular:min-h-[calc(100dvh-65px)] regular:grid-cols-[minmax(0,1fr)_minmax(0,600px)] regular:items-center regular:gap-12 regular:px-12 regular:py-16"
      >
        <section
          aria-labelledby="hero-title"
          className="flex flex-col gap-4 bg-rp-live px-4 pt-4 pb-20 text-rp-on-live medium:bg-transparent medium:p-0 medium:pb-10 medium:text-rp-ink regular:pb-0"
        >
          {/* Compact: the brand sits in the teal band (the header shows from medium up). */}
          <div className="flex items-center justify-between medium:hidden">
            <span className="flex items-center gap-2">
              <CrescentIcon size={24} />
              <span className="rp-headline">{tCommon("appName")}</span>
            </span>
            <TextThemeButton tone="live" className="-mr-2" />
          </div>
          <p className="rp-caption hidden text-rp-accent medium:block" data-testid="landing-date" suppressHydrationWarning>
            {dateLine}
          </p>
          <h1 id="hero-title" className="rp-h1 medium:rp-display-l">
            {t("heroTitle")}
          </h1>
          <p className="rp-body max-w-[560px] medium:max-w-[720px] medium:text-rp-muted regular:rp-greeting regular:font-normal">
            {t("heroSubtitle")} <span className="hidden medium:inline">{t("heroNote")}</span>
          </p>
          <div className="mt-4 hidden gap-4 medium:flex">
            <Link href={startHref} className={buttonVariants({ size: "lg" })} data-testid="landing-start-web">
              {t("getStarted")}
            </Link>
            <button type="button" onClick={() => setSheetOpen(true)} className={buttonVariants({ variant: "soft", size: "lg" })}>
              {t("chooseDistrict")}
            </button>
          </div>
        </section>

        {/* Today's real times. */}
        <div className="-mt-14 px-4 medium:mt-0 medium:px-0">
          <div className="medium:hidden">
            {timings && phaseTimings ? (
              <TodayCard timings={phaseTimings} timeZone={timeZone} now={now} title={t("todayTitle", { place })} hijri={hijri} />
            ) : (
              placeholder
            )}
          </div>
          <div className="hidden flex-col gap-4 medium:flex">
            {timings && phaseTimings ? (
              <>
                <PrayerHero timings={phaseTimings} timeZone={timeZone} initialNow={initialNow} />
                <SehriIftarPair timings={phaseTimings} timeZone={timeZone} />
                <PrayerList timings={phaseTimings} timeZone={timeZone} hideHeader hideReminders initialNow={initialNow} />
              </>
            ) : (
              placeholder
            )}
            <p className="rp-caption text-rp-muted" data-testid="landing-sample-source">
              {source}
            </p>
          </div>
        </div>

        {/* Compact: the primary action in the lower part of the screen, with the source line. */}
        <div className="mt-auto flex flex-col gap-3 px-4 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center medium:hidden">
          <Link href={startHref} className={cn(buttonVariants({ size: "lg" }), "w-full")} data-testid="landing-start">
            {t("getStarted")}
          </Link>
          <p className="rp-caption text-rp-muted">
            {source}
            <br />
            {t("heroNoteShort")}
          </p>
        </div>
      </main>

      <footer className="border-t border-rp-rule py-6">
        <div className="mx-auto flex max-w-[1296px] flex-col items-center gap-2 px-4 text-center medium:flex-row medium:justify-between medium:px-6 regular:px-12">
          <BrandLockup className="hidden medium:flex" />
          <nav aria-label={t("footerNav")} className="flex flex-wrap justify-center gap-x-2">
            {(
              [
                ["/timetable", "footerTimetable"],
                ["/quran", "footerQuran"],
                ["/support", "footerSupport"],
              ] as const
            ).map(([href, key]) => (
              <Link key={href} href={href} className="rp-small inline-flex min-h-11 items-center px-2 font-medium text-rp-accent underline-offset-4 hover:underline">
                {t(key)}
              </Link>
            ))}
          </nav>
          <p className="rp-caption text-rp-muted">
            &copy; {formatLocalizedNumber(year, locale)} {tCommon("appName")}
          </p>
        </div>
      </footer>

      <LocationSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
