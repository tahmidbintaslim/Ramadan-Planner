import { useSyncExternalStore, type ComponentType } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { SectionHeader } from "@/components/design/section-header";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CrescentIcon,
  FajrIcon,
  HeartIcon,
  LanternIcon,
  MaghribIcon,
  MosqueIcon,
  PinIcon,
  PlanIcon,
  QuranIcon,
  TasbihIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";
import { SiteHeader } from "@/components/layout/site-header";
import { useAuth } from "@/components/providers/auth-provider";
import { needsOnboarding } from "@/lib/user-location";
import { cn } from "@/lib/utils";
import { isHiddenPath } from "@/config/features";

type LandingKey = Parameters<ReturnType<typeof useTranslations<"landing">>>[0];

const FEATURES: ReadonlyArray<{ title: LandingKey; desc: LandingKey; href: string; Icon: ComponentType<IconProps> }> = [
  { title: "tilePrayerTitle", desc: "tilePrayerDesc", href: "/today", Icon: MosqueIcon },
  { title: "tileTimetableTitle", desc: "tileTimetableDesc", href: "/timetable", Icon: CalendarIcon },
  { title: "tilePlanTitle", desc: "tilePlanDesc", href: "/plan", Icon: PlanIcon },
  { title: "tileQuranTitle", desc: "tileQuranDesc", href: "/quran", Icon: QuranIcon },
  { title: "tileRemindersTitle", desc: "tileRemindersDesc", href: "/reminders", Icon: BellIcon },
  { title: "tileTasbihTitle", desc: "tileTasbihDesc", href: "/tasbih", Icon: TasbihIcon },
].filter((f) => !isHiddenPath(f.href)); // src/config/features.ts decides what is shown

const PROMISES: ReadonlyArray<{ title: LandingKey; desc: LandingKey; Icon: ComponentType<IconProps> }> = [
  { title: "promiseFreeTitle", desc: "promiseFreeDesc", Icon: HeartIcon },
  { title: "promiseNoAdsTitle", desc: "promiseNoAdsDesc", Icon: CheckIcon },
  { title: "promisePrivacyTitle", desc: "promisePrivacyDesc", Icon: PinIcon },
];

/**
 * Where "start free" leads: onboarding for a first-time guest, straight to the Home otherwise. The server (and
 * the hydrating render) link to onboarding; the device's choice is read after mount.
 */
const noSubscribe = () => () => {};

function useStartHref(): string {
  const { user } = useAuth();
  const onboard = useSyncExternalStore(
    noSubscribe,
    () => needsOnboarding(user !== null),
    () => true,
  );
  return onboard ? "/welcome" : "/today";
}

/** A sample Sehri/Iftar card (static, labelled নমুনা): what the Home shows, without a network request. */
function SampleTimesCard() {
  const t = useTranslations("landing");
  return (
    <section
      aria-labelledby="sample-title"
      data-testid="landing-sample"
      className="relative flex flex-col gap-4 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="sample-title" className="rp-row inline-flex items-center gap-2 font-semibold">
          <PinIcon size={20} className="text-rp-accent" />
          {t("sampleTitle")}
        </h2>
        <Badge variant="gold">{t("sampleBadge")}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-rp-md bg-rp-accent-tint p-4">
          <dt className="rp-small inline-flex items-center gap-1.5 text-rp-muted">
            <FajrIcon size={18} className="text-rp-accent" />
            {t("sampleSehri")}
          </dt>
          <dd className="rp-time-l mt-1 tabular-nums text-rp-ink">{t("sampleSehriTime")}</dd>
        </div>
        <div className="rounded-rp-md bg-rp-gold-tint p-4">
          <dt className="rp-small inline-flex items-center gap-1.5 text-rp-muted">
            <MaghribIcon size={18} className="text-rp-gold-text" />
            {t("sampleIftar")}
          </dt>
          <dd className="rp-time-l mt-1 tabular-nums text-rp-ink">{t("sampleIftarTime")}</dd>
        </div>
      </dl>
      <p data-testid="landing-sample-source" className="rp-caption text-rp-muted">
        {t("sampleSource")}
      </p>
    </section>
  );
}

/**
 * The copyright year: the server's year (from the route loader, so the hydrating render matches the HTML), then
 * the device's year after mount.
 */
export function useFooterYear(serverYear: number): number {
  return useSyncExternalStore(noSubscribe, () => new Date().getFullYear(), () => serverYear);
}

export function LandingPage({ serverYear = new Date().getFullYear() }: { serverYear?: number }) {
  const t = useTranslations("landing");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const startHref = useStartHref();
  const year = useFooterYear(serverYear);

  return (
    <div className="min-h-screen bg-rp-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-rp-sm focus:bg-rp-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />

      <main id="main-content" className="mx-auto flex w-full max-w-[1120px] flex-col gap-14 px-4 pb-16 pt-4 sm:gap-20 sm:px-6 sm:pt-8">
        {/* Hero: a calm mint sky with the arch, the lattice and the crescent; the sample card is its picture. */}
        <section
          aria-labelledby="hero-title"
          className="relative isolate overflow-hidden rounded-rp-xl bg-rp-accent-tint px-5 py-10 sm:px-10 sm:py-14 lg:px-14"
        >
          <GirihPattern opacity={0.07} className="-z-10 text-rp-accent" />
          <MihrabArch className="pointer-events-none absolute bottom-0 right-[-40px] -z-10 h-[340px] w-[340px] text-rp-accent sm:right-6 lg:right-[38%]" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="flex flex-col gap-5">
              <CrescentIcon size={40} className="text-rp-gold-text" />
              <h1 id="hero-title" className="font-display text-[34px] leading-[48px] text-rp-ink sm:text-[44px] sm:leading-[60px]">
                {t("heroTitle")}
              </h1>
              <p className="rp-body max-w-xl text-rp-muted sm:text-[18px] sm:leading-[30px]">{t("heroSubtitle")}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={startHref} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")} data-testid="landing-start">
                  {t("getStarted")}
                </Link>
                <Link
                  href="/timetable"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
                >
                  {t("todayTimetable")}
                </Link>
              </div>
              <p className="rp-small text-rp-muted">{t("heroNote")}</p>
            </div>
            <SampleTimesCard />
          </div>
        </section>

        <section aria-labelledby="features-title" className="flex flex-col gap-5">
          <SectionHeader id="features-title" title={t("featuresTitle")} />
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {FEATURES.map(({ title, desc, href, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-full min-h-[132px] flex-col gap-3 rounded-rp-lg bg-rp-surface p-4 text-rp-ink shadow-rp-soft outline-none transition-colors hover:bg-rp-accent-tint/60 focus-visible:ring-[3px] focus-visible:ring-ring sm:p-5"
                >
                  <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-rp-accent-tint text-rp-accent">
                    <Icon size={24} />
                  </span>
                  <span className="rp-row block">{t(title)}</span>
                  <span className="rp-small block text-rp-muted">{t(desc)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="promise-title" className="flex flex-col gap-5">
          <SectionHeader id="promise-title" title={t("promiseTitle")} />
          <ul className="grid gap-3 sm:gap-4 md:grid-cols-3">
            {PROMISES.map(({ title, desc, Icon }) => (
              <li key={title} className="flex gap-4 rounded-rp-lg bg-rp-surface p-5 shadow-rp-soft">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rp-accent-tint text-rp-accent">
                  <Icon size={24} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="rp-row text-rp-ink">{t(title)}</span>
                  <span className="rp-small text-rp-muted">{t(desc)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="support-teaser-title"
          className="relative isolate flex flex-col gap-4 overflow-hidden rounded-rp-xl bg-rp-gold-tint p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <GirihPattern opacity={0.06} className="-z-10 text-rp-gold-text" />
          <div className="flex gap-4">
            <LanternIcon size={48} className="shrink-0 text-rp-gold-text" />
            <div className="flex flex-col gap-1">
              <h2 id="support-teaser-title" className="rp-h2 text-rp-ink">
                {t("supportTitle")}
              </h2>
              <p className="rp-small max-w-xl text-rp-ink">{t("supportDesc")}</p>
            </div>
          </div>
          <Link href="/support" className={cn(buttonVariants({ variant: "outline" }), "shrink-0 self-start sm:self-center")}>
            {t("supportAction")}
            <ChevronRightIcon size={18} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-rp-rule bg-rp-surface py-8">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-3 px-4 text-center sm:px-6">
          <p className="rp-small inline-flex items-center gap-2 text-rp-muted">
            <CrescentIcon size={18} className="text-rp-accent" />
            {t("footerTagline")}
          </p>
          <nav aria-label={t("footerNav")} className="flex flex-wrap justify-center gap-x-2">
            {(
              [
                ["/timetable", "footerTimetable"],
                ["/quran", "footerQuran"],
                ["/support", "footerSupport"],
              ] as const
            ).map(([href, key]) => (
              <Link key={href} href={href} className="rp-small inline-flex min-h-12 items-center px-2 text-rp-accent underline-offset-4 hover:underline">
                {t(key)}
              </Link>
            ))}
          </nav>
          <p className="rp-caption text-rp-muted">
            &copy; {formatLocalizedNumber(year, locale)} {tCommon("appName")}
          </p>
        </div>
      </footer>
    </div>
  );
}
