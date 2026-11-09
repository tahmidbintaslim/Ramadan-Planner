import { useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { useCalcSource } from "@/components/prayer/use-calc-source";
import { ArrowRight, CalendarClock, ListChecks, MapPin, Monitor, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import {
  CheckIcon,
  CodeIcon,
  GlobeIcon,
  HeartIcon,
  QuranIcon,
  SalahTimeIcon,
  TasbihIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";
import { BrandLockup, SiteHeader } from "@/components/layout/site-header";
import { useAuth } from "@/components/providers/auth-provider";
import { heroLabel, heroLines, heroResult } from "@/components/prayer/prayer-hero";
import { SehriIftarPair } from "@/components/prayer/sehri-iftar-pair";
import { formatPrayerClock, formatRemaining } from "@/components/prayer/use-prayer-phase";
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
import { SUPPORT_CONFIG } from "@/config/support";

type Icon = ComponentType<IconProps> | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type T = ReturnType<typeof useTranslations<"landing">>;

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

/** The tinted 44 icon tile used by steps, feature tags, trust and install cards. */
function IconTile({ Icon, className }: { Icon: Icon; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center rounded-rp-input bg-rp-accent-tint text-rp-icon", className)}>
      <Icon size={24} />
    </span>
  );
}

function Ticks({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => (
        <li key={item} className="rp-body flex items-start gap-2 text-rp-ink">
          <CheckIcon size={20} className="mt-0.5 shrink-0 text-rp-accent" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Section heading: eyebrow, title, optional subtitle, centred. */
function SectionHead({ id, eyebrow, title, sub }: { id: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-10 flex max-w-[720px] flex-col gap-2 text-center regular:mb-14">
      <p className="rp-callout font-semibold text-rp-accent">{eyebrow}</p>
      <h2 id={id} className="rp-h1 text-rp-ink">
        {title}
      </h2>
      {sub ? <p className="rp-body text-rp-muted">{sub}</p> : null}
    </div>
  );
}

/** Two concentric arch lines (the page's one motif), drawn in the current colour. */
function ArchLines({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 480" fill="none" preserveAspectRatio="xMidYMax meet" className={className}>
      <path d="M20 480V200C20 104 110 42 200 20C290 42 380 104 380 200V480" stroke="currentColor" strokeWidth="1.5" />
      <path d="M44 480V206C44 122 122 66 200 46C278 66 356 122 356 206V480" stroke="currentColor" strokeOpacity="0.5" />
    </svg>
  );
}

/** A real app screenshot (390×844 CSS px, served at 2x) in a plain phone frame; bn has a dark capture, en does not. */
function Phone({ screen, alt, className, eager }: { screen: string; alt: string; className?: string; eager?: boolean }) {
  const locale = useLocale() === "en" ? "en" : "bn";
  const loading = eager ? "eager" : "lazy";
  return (
    <div className={cn("rounded-[44px] border-[10px] border-[#17211F] bg-[#17211F] shadow-[0_24px_60px_-20px_rgba(16,48,43,0.45)]", className)}>
      <div className="overflow-hidden rounded-[34px]">
        <img
          src={`/home/phone-${locale}-light-${screen}.webp`}
          alt={alt}
          width={390}
          height={844}
          loading={loading}
          decoding="async"
          className={cn("block h-auto w-full", locale === "bn" && "dark:hidden")}
        />
        {locale === "bn" ? (
          <img
            src={`/home/phone-bn-dark-${screen}.webp`}
            alt={alt}
            width={390}
            height={844}
            loading="lazy"
            decoding="async"
            className="hidden h-auto w-full dark:block"
          />
        ) : null}
      </div>
    </div>
  );
}

/** Next prayer row under the Sehri/Iftar pair: label, the prayer, its time and the countdown. */
function NextPrayerRow({ timings, timeZone, now }: { timings: PhaseTimings; timeZone: string; now: Date }) {
  const t = useTranslations("prayer");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  const r = heroResult(getPrayerPhase(now, timings), timings, now, false);
  const { eyebrow, title } = heroLines(heroLabel(r, timings, t, tSalah, false), r, t, tSalah);
  return (
    <div className="flex min-h-[76px] items-center gap-4 rounded-rp-lg bg-rp-surface px-4 py-3">
      <IconTile Icon={SalahTimeIcon} />
      <div className="min-w-0 flex-1">
        <p className="rp-small text-rp-muted">{eyebrow}</p>
        <p className="rp-headline text-rp-ink">{title}</p>
      </div>
      <div className="text-end" suppressHydrationWarning>
        <p className="rp-h2 whitespace-nowrap tabular-nums text-rp-ink">{formatPrayerClock(r.next.at, timeZone, locale, clockFormat)}</p>
        <p className="rp-small text-rp-accent">{formatRemaining(r.remainingMs, locale)}</p>
      </div>
    </div>
  );
}

const FEATURES = [
  { key: "Today", screen: "today", Icon: SalahTimeIcon },
  { key: "Amal", screen: "plan", Icon: ListChecks },
  { key: "Quran", screen: "quran-1", Icon: QuranIcon },
  { key: "Time", screen: "timetable", Icon: CalendarClock },
  { key: "Dua", screen: "duas", Icon: TasbihIcon },
] as const;

function FeatureRow({ f, index, t }: { f: (typeof FEATURES)[number]; index: number; t: T }) {
  const tag = t(`f${f.key}Tag`);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 regular:grid-cols-2 regular:gap-16">
      <div className={cn("flex flex-col gap-4", index % 2 === 1 && "regular:order-2")}>
        <p className="flex items-center gap-3">
          <IconTile Icon={f.Icon} />
          <span className="rp-headline text-rp-accent">{tag}</span>
        </p>
        <h3 className="rp-h2 text-rp-ink regular:rp-h1">{t(`f${f.key}Title`)}</h3>
        <p className="rp-body text-rp-muted">{t(`f${f.key}Body`)}</p>
        <Ticks items={[t(`f${f.key}1`), t(`f${f.key}2`), t(`f${f.key}3`)]} />
      </div>
      <div className="relative flex h-[440px] justify-center overflow-hidden rounded-[32px] bg-rp-accent-tint pt-12 regular:h-[560px] regular:pt-16">
        <ArchLines className="absolute inset-x-0 bottom-0 mx-auto h-[92%] text-rp-accent/40" />
        <Phone screen={f.screen} alt={t("shotAlt", { screen: tag })} className="relative w-[260px] self-start regular:w-[276px]" />
      </div>
    </li>
  );
}

function InstallCard({ Icon, title, body, live, t, children }: { Icon: Icon; title: string; body: string; live?: boolean; t: T; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-rp-xl bg-rp-page p-6">
      <div className="flex items-center justify-between gap-2">
        <IconTile Icon={Icon} />
        <span
          className={cn(
            "rp-small rounded-rp-full px-3 py-1 font-medium",
            live ? "bg-rp-accent-tint text-rp-accent" : "bg-rp-gold-tint text-rp-gold-text",
          )}
        >
          {live ? t("availableNow") : t("comingSoon")}
        </span>
      </div>
      <h3 className="rp-headline text-rp-ink">{title}</h3>
      <p className="rp-body text-rp-muted">{body}</p>
      {children}
    </li>
  );
}

/**
 * The web homepage (Figma page 11, "Homepage v2", founder approved): hero with today's live times and the real
 * Today screen in a phone over the vector arch art, then how it works, five feature demos (real screenshots), a
 * 30-second screen recording, trust, install, support and the footer. Every time is live from /api/timings.
 */
export function LandingPage({ serverYear = new Date().getFullYear(), initialNow }: { serverYear?: number; initialNow?: Date }) {
  const t = useTranslations("landing");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const tPrayer = useTranslations("prayer");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "bn";
  const startHref = useStartHref();
  const year = useFooterYear(serverYear);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { home, phaseTimings, timeZone, now } = useLiveTimes(initialNow);
  const calcSource = useCalcSource();
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
    source: fresh
      ? (calcSource(timings.calc) ?? tHome(timings.source === "islamicapi" ? "sourceIslamicApi" : "sourceAladhan"))
      : tHome("sourceUnverified"),
  });
  const weekday = (() => {
    try {
      return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long", timeZone }).format(now);
    } catch {
      return "";
    }
  })();
  const dateLine = [weekday, hijri, place].filter(Boolean).join(" · ");
  const repo = SUPPORT_CONFIG.repoUrl;
  const anchors = [
    ["#how", "navHow"],
    ["#features", "navFeatures"],
    ["#install", "navInstall"],
    ["#support", "navSupport"],
  ] as const;
  const section = "mx-auto w-full max-w-[1296px] px-4 py-16 medium:px-6 regular:px-12 regular:py-24";

  return (
    <div className="flex min-h-dvh flex-col bg-rp-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-rp-sm focus:bg-rp-surface focus:px-3 focus:py-2 focus:shadow"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader>
        <nav aria-label={t("pageNav")} className="me-2 hidden regular:flex">
          {anchors.map(([href, key]) => (
            <a key={href} href={href} className="rp-callout inline-flex min-h-11 items-center rounded-rp-input px-3 text-rp-ink hover:text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus">
              {t(key)}
            </a>
          ))}
        </nav>
      </SiteHeader>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* 01 Hero */}
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid w-full max-w-[1296px] grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-8 pb-16 medium:px-6 regular:grid-cols-[minmax(0,1fr)_minmax(0,560px)] regular:items-center regular:gap-12 regular:px-12 regular:pt-16 regular:pb-24"
        >
          <div className="flex flex-col gap-4">
            <p className="rp-callout text-rp-accent" data-testid="landing-date" suppressHydrationWarning>
              {dateLine}
            </p>
            <h1 id="hero-title" className="rp-h1 text-rp-ink medium:rp-display-l">
              {t("heroTitle")}
            </h1>
            <p className="rp-body max-w-[640px] text-rp-muted regular:rp-greeting regular:font-normal">{t("heroSubtitle")}</p>
            <div className="mt-2 flex flex-col gap-3 medium:flex-row medium:gap-4">
              <Link href={startHref} className={cn(buttonVariants({ size: "lg" }), "w-full medium:w-auto")} data-testid="landing-start">
                {t("getStarted")}
              </Link>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={cn(buttonVariants({ variant: "soft", size: "lg" }), "w-full medium:w-auto")}
              >
                {t("chooseDistrict")}
              </button>
            </div>

            {/* Today's real times. */}
            <section aria-labelledby="landing-today" data-testid="landing-sample" className="mt-4 flex flex-col gap-2">
              <h2 id="landing-today" className="rp-small flex items-center gap-2 text-rp-ink">
                <span aria-hidden="true" className="size-2 rounded-rp-full bg-rp-accent" />
                {t("todayIn", { place })}
              </h2>
              {timings && phaseTimings ? (
                <>
                  <SehriIftarPair timings={phaseTimings} timeZone={timeZone} />
                  <NextPrayerRow timings={phaseTimings} timeZone={timeZone} now={now} />
                </>
              ) : (
                <div role="status" className="flex h-[166px] items-end rounded-rp-lg bg-rp-surface p-6 text-rp-muted motion-safe:animate-pulse">
                  <span className="rp-small">{home.status === "error" ? t("timesUnavailable") : t("timesLoading")}</span>
                </div>
              )}
              {/* Same height as the real content (pair 82 + gap 8 + next-prayer row 76) and a two-line source line on
                  phones, so the times arriving do not push the page down (landing CLS was 0.16 in production). */}
              <p className="rp-small min-h-[2lh] text-rp-muted medium:min-h-0" data-testid="landing-sample-source">
                {source}
              </p>
            </section>
            <ul className="rp-small flex flex-wrap gap-x-5 gap-y-1 text-rp-muted">
              {(["tickFree", "tickNoAds", "tickNoSignup"] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <CheckIcon size={16} className="text-rp-accent" />
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>

          {/* The real Today screen over the vector arch art: the logo crescent and star in the open sky, Hugeicons lanterns. */}
          <div className="relative mx-auto w-full max-w-[560px]">
            <img src="/home/hero-art-light.svg" alt="" width={640} height={660} className="block h-auto w-full dark:hidden" />
            <img src="/home/hero-art-dark.svg" alt="" width={640} height={660} className="hidden h-auto w-full dark:block" />
            <Phone screen="today" alt={t("heroArtLabel")} eager className="absolute left-[57%] top-[19%] w-[44%] -translate-x-1/2" />
          </div>
        </section>

        {/* 02 How it works */}
        <section id="how" aria-labelledby="how-title" className={section}>
          <SectionHead id="how-title" eyebrow={t("howEyebrow")} title={t("howTitle")} sub={t("howSub")} />
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-4 regular:grid-cols-3 regular:gap-6">
            {([GlobeIcon, MapPin, SalahTimeIcon] as const).map((Icon, i) => (
              <li key={i} className="flex flex-col gap-3 rounded-rp-xl bg-rp-surface p-6 regular:p-8">
                <IconTile Icon={Icon} className="size-14" />
                <p className="rp-small font-medium text-rp-accent">{t("step", { n: formatLocalizedNumber(i + 1, locale) })}</p>
                <h3 className="rp-h2 text-rp-ink">{t(`step${i + 1}Title` as "step1Title")}</h3>
                <p className="rp-body text-rp-muted">{t(`step${i + 1}Body` as "step1Body")}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 03 Feature demos */}
        <section id="features" aria-labelledby="features-title" className={section}>
          <SectionHead id="features-title" eyebrow={t("featEyebrow")} title={t("featTitle")} sub={t("featSub")} />
          <ul className="flex flex-col gap-16 regular:gap-24">
            {FEATURES.map((f, i) => (
              <FeatureRow key={f.key} f={f} index={i} t={t} />
            ))}
          </ul>
        </section>

        {/* 04 Demo video: a real screen recording, no sound, loaded only when played. */}
        <section aria-labelledby="video-title" className="bg-rp-surface">
          <div className={section}>
            <SectionHead id="video-title" eyebrow={t("videoEyebrow")} title={t("videoTitle")} sub={t("videoSub")} />
            <div className="mx-auto max-w-[960px] overflow-hidden rounded-rp-xl border border-rp-rule bg-rp-page shadow-[0_24px_60px_-28px_rgba(16,48,43,0.4)]">
              <div aria-hidden="true" className="flex h-10 items-center gap-2 border-b border-rp-rule px-4">
                <span className="size-3 rounded-rp-full bg-rp-rule" />
                <span className="size-3 rounded-rp-full bg-rp-rule" />
                <span className="size-3 rounded-rp-full bg-rp-rule" />
              </div>
              <video
                controls
                muted
                playsInline
                preload="none"
                poster={`/home/demo-${lang}.webp`}
                aria-label={t("videoLabel")}
                width={1280}
                height={720}
                className="block aspect-video h-auto w-full bg-rp-page"
              >
                <source src={`/home/demo-${lang}.mp4`} type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        {/* 05 Trust */}
        <section aria-labelledby="trust-title" className={section}>
          <SectionHead id="trust-title" eyebrow={t("trustEyebrow")} title={t("trustTitle")} />
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 medium:grid-cols-2 regular:grid-cols-4 regular:gap-6">
            {(
              [
                [HeartIcon, 1],
                [SalahTimeIcon, 2],
                [CodeIcon, 3],
                [null, 4],
              ] as const
            ).map(([Icon, n]) => (
              <li key={n} className="flex flex-col gap-3 rounded-rp-xl bg-rp-surface p-6">
                {Icon ? (
                  <IconTile Icon={Icon} />
                ) : (
                  <span aria-hidden="true" lang="bn" className="rp-headline flex size-11 items-center justify-center rounded-rp-input bg-rp-accent-tint text-rp-icon">
                    অ
                  </span>
                )}
                <h3 className="rp-headline text-rp-ink">{t(`trust${n}Title`)}</h3>
                <p className="rp-body text-rp-muted">{t(`trust${n}Body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 06 Install: no store badges until the apps are listed. */}
        <section id="install" aria-labelledby="install-title" className="bg-rp-surface">
          <div className={section}>
            <SectionHead id="install-title" eyebrow={t("installEyebrow")} title={t("installTitle")} sub={t("installSub")} />
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 medium:grid-cols-2 regular:grid-cols-4 regular:gap-6">
              <InstallCard Icon={GlobeIcon} title={t("webTitle")} body={t("webBody")} live t={t}>
                <Link href={startHref} className={cn(buttonVariants(), "mt-auto self-start")}>
                  {t("openInBrowser")}
                </Link>
              </InstallCard>
              <InstallCard Icon={Smartphone} title={t("androidTitle")} body={t("storeBody")} t={t} />
              <InstallCard Icon={Smartphone} title={t("iosTitle")} body={t("storeBody")} t={t} />
              <InstallCard Icon={Monitor} title={t("desktopTitle")} body={t("desktopBody")} t={t} />
            </ul>
          </div>
        </section>

        {/* 07 Support & contribute */}
        <section id="support" aria-labelledby="support-title" className={section}>
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-[32px] bg-rp-live p-8 text-rp-on-live regular:flex-row regular:items-center regular:p-12">
            <ArchLines className="pointer-events-none absolute -right-16 bottom-0 hidden h-[110%] text-rp-on-live/50 regular:block" />
            <div className="relative flex flex-1 flex-col gap-4">
              <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-rp-md bg-black/15">
                <HeartIcon size={28} />
              </span>
              <h2 id="support-title" className="rp-h1">
                {t("supportTitle")}
              </h2>
              <p className="rp-body max-w-[720px]">{t("supportBody")}</p>
            </div>
            <div className="relative flex flex-col gap-3 medium:flex-row medium:items-center regular:me-24">
              <Link href="/support" className={cn(buttonVariants({ variant: "soft", size: "lg" }), "bg-rp-page text-rp-accent hover:bg-rp-page/90")}>
                {t("supportCta")}
              </Link>
              <a
                href={repo}
                rel="noopener noreferrer"
                target="_blank"
                className="rp-button inline-flex min-h-11 items-center gap-2 rounded-rp-input px-3 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t("viewSource")}
                <ArrowRight size={20} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 08 Footer */}
      <footer className="border-t border-rp-rule bg-rp-surface">
        <div className="mx-auto grid max-w-[1296px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-12 medium:px-6 regular:grid-cols-[1fr_auto_auto] regular:gap-24 regular:px-12">
          <div className="flex flex-col gap-2">
            <BrandLockup />
            <p className="rp-small text-rp-muted">{t("footerTagline")}</p>
          </div>
          <nav aria-label={t("footerNav")} className="grid grid-cols-2 gap-8 regular:contents">
            <div className="flex flex-col">
              <p className="rp-small mb-1 text-rp-muted">{t("footerApp")}</p>
              {(
                [
                  ["/today", "footerToday"],
                  ["/timetable", "footerTimetable"],
                  ["/plan", "footerAmal"],
                  ["/quran", "footerQuran"],
                  ["/duas", "footerDuas"],
                ] as const
              ).map(([href, key]) => (
                <Link key={href} href={href} className="rp-body inline-flex min-h-11 items-center text-rp-ink hover:text-rp-accent">
                  {t(key)}
                </Link>
              ))}
            </div>
            <div className="flex flex-col">
              <p className="rp-small mb-1 text-rp-muted">{t("footerProject")}</p>
              <Link href="/support" className="rp-body inline-flex min-h-11 items-center text-rp-ink hover:text-rp-accent">
                {t("footerSupport")}
              </Link>
              <a href={repo} rel="noopener noreferrer" target="_blank" className="rp-body inline-flex min-h-11 items-center text-rp-ink hover:text-rp-accent">
                {t("footerSource")}
              </a>
              <a href={`${repo}/issues`} rel="noopener noreferrer" target="_blank" className="rp-body inline-flex min-h-11 items-center text-rp-ink hover:text-rp-accent">
                {t("footerReport")}
              </a>
            </div>
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1296px] flex-col gap-2 border-t border-rp-rule px-4 py-6 medium:px-6 regular:flex-row regular:justify-between regular:px-12">
          <p className="rp-small text-rp-muted">{t("footerTimesSource")}</p>
          <p className="rp-small text-rp-muted">
            {t("footerPromise")} · &copy; {formatLocalizedNumber(year, locale)} {tCommon("appName")}
          </p>
        </div>
      </footer>

      <LocationSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
