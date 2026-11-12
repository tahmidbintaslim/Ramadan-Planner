import type { ComponentType, ReactNode } from "react";
import { ArrowRight, Languages } from "lucide-react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import { BellIcon, CodeIcon, HeartIcon, TasbihIcon, ZakatIcon, AlertIcon, type IconProps } from "@/components/icons/islamic-icons";
import { SUPPORT_CONFIG, mailtoHref } from "@/config/support";
import { cn } from "@/lib/utils";
import { FEATURES, FeatureRow, IconTile, SectionHead, Ticks } from "./landing-page";
import { MarketingShell, marketingSection, useStartHref } from "./marketing-shell";

type Icon = ComponentType<IconProps> | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

/** The page's opening: Large Title and one line, centred. */
function PageIntro({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 pt-12 text-center medium:px-6 regular:pt-20">
      <h1 className="rp-h1 text-rp-ink medium:rp-display-l">{title}</h1>
      <p className="rp-body text-rp-muted regular:rp-greeting regular:font-normal">{sub}</p>
    </div>
  );
}

function Card({ Icon, title, body, children }: { Icon: Icon; title: string; body: string; children?: ReactNode }) {
  return (
    <li className="rp-reveal flex flex-col gap-3 rounded-rp-xl bg-rp-surface p-6">
      <IconTile Icon={Icon} />
      <h2 className="rp-headline text-rp-ink">{title}</h2>
      <p className="rp-body text-rp-muted">{body}</p>
      {children}
    </li>
  );
}

/** The closing band every site page ends with: one line and the start button. */
function StartBand() {
  const t = useTranslations("landing");
  const tM = useTranslations("marketing");
  const startHref = useStartHref();
  return (
    <section aria-labelledby="start-title" className={marketingSection}>
      <div className="rp-reveal flex flex-col items-start gap-4 rounded-[32px] bg-rp-live p-8 text-rp-on-live regular:flex-row regular:items-center regular:justify-between regular:p-12">
        <div className="flex flex-col gap-2">
          <h2 id="start-title" className="rp-h1">
            {tM("ctaTitle")}
          </h2>
          <p className="rp-body">{tM("ctaBody")}</p>
        </div>
        <Link href={startHref} className={cn(buttonVariants({ variant: "soft", size: "lg" }), "bg-rp-page text-rp-accent hover:bg-rp-page/90")}>
          {t("getStarted")}
        </Link>
      </div>
    </section>
  );
}

const external = { rel: "noopener noreferrer", target: "_blank" } as const;
const textLink = "rp-button mt-auto inline-flex min-h-11 items-center gap-2 self-start text-rp-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus";

/** /features: the five feature demos (real screens) and the smaller tools. */
export function FeaturesPage({ serverYear }: { serverYear: number }) {
  const t = useTranslations("landing");
  const tM = useTranslations("marketing");
  return (
    <MarketingShell serverYear={serverYear}>
      <PageIntro title={tM("featuresTitle")} sub={tM("featuresSub")} />
      <section aria-label={tM("navFeatures")} className={marketingSection}>
        <ul className="flex flex-col gap-16 regular:gap-24">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.key} f={f} index={i} t={t} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="more-title" className="bg-rp-surface">
        <div className={marketingSection}>
          <SectionHead id="more-title" eyebrow={tM("moreEyebrow")} title={tM("moreTitle")} />
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 medium:grid-cols-2 regular:grid-cols-4 regular:gap-6 [&>li]:bg-rp-page">
            <Card Icon={TasbihIcon} title={tM("toolTasbihTitle")} body={tM("toolTasbihBody")} />
            <Card Icon={ZakatIcon} title={tM("toolZakatTitle")} body={tM("toolZakatBody")} />
            <Card Icon={BellIcon} title={tM("toolRemindTitle")} body={tM("toolRemindBody")} />
            <Card Icon={Languages} title={tM("toolLangTitle")} body={tM("toolLangBody")} />
          </ul>
        </div>
      </section>
      <StartBand />
    </MarketingShell>
  );
}

/** /pricing: the app is free; one plan with everything, the optional ways to help, and three questions. */
export function PricingPage({ serverYear }: { serverYear: number }) {
  const t = useTranslations("landing");
  const tM = useTranslations("marketing");
  const startHref = useStartHref();
  return (
    <MarketingShell serverYear={serverYear}>
      <PageIntro title={tM("pricingTitle")} sub={tM("pricingSub")} />
      <section aria-label={tM("navPricing")} className={cn(marketingSection, "grid grid-cols-[minmax(0,1fr)] gap-6 regular:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
        <div className="rp-reveal flex flex-col gap-6 rounded-[32px] border-2 border-rp-accent bg-rp-surface p-8 regular:p-10">
          <div className="flex flex-col gap-1">
            <h2 className="rp-headline text-rp-accent">{tM("planName")}</h2>
            <p className="flex items-baseline gap-3">
              <span className="rp-display-l text-rp-ink">{tM("planPrice")}</span>
              <span className="rp-body text-rp-muted">{tM("planPeriod")}</span>
            </p>
          </div>
          <Ticks items={[tM("plan1"), tM("plan2"), tM("plan3"), tM("plan4"), tM("plan5"), tM("plan6")]} />
          <Link href={startHref} className={cn(buttonVariants({ size: "lg" }), "self-start")}>
            {t("getStarted")}
          </Link>
          <p className="rp-small text-rp-muted">{[t("tickFree"), t("tickNoAds"), t("tickNoSignup")].join(" · ")}</p>
        </div>
        <div className="rp-reveal flex flex-col gap-3 rounded-[32px] bg-rp-gold-tint p-8 regular:p-10">
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-rp-input bg-rp-surface text-rp-gold-text">
            <HeartIcon size={24} />
          </span>
          <h2 className="rp-h2 text-rp-ink">{tM("supportCardTitle")}</h2>
          <p className="rp-body text-rp-ink">{tM("supportCardBody")}</p>
          <Link href="/support" className={textLink}>
            {tM("supportCardCta")}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section aria-labelledby="faq-title" className="bg-rp-surface">
        <div className={cn(marketingSection, "max-w-[860px]")}>
          <h2 id="faq-title" className="rp-h1 mb-6 text-rp-ink">
            {tM("faqTitle")}
          </h2>
          <dl className="flex flex-col">
            {([1, 2, 3] as const).map((n) => (
              <div key={n} className="rp-reveal flex flex-col gap-1 border-t border-rp-rule py-5">
                <dt className="rp-headline text-rp-ink">{tM(`faq${n}Q`)}</dt>
                <dd className="rp-body text-rp-muted">{tM(`faq${n}A`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <StartBand />
    </MarketingShell>
  );
}

/** /contact: where to report a problem, suggest something or write (by email when an address is set, else on GitHub). */
export function ContactPage({ serverYear }: { serverYear: number }) {
  const tM = useTranslations("marketing");
  const repo = SUPPORT_CONFIG.repoUrl;
  const mail = mailtoHref(SUPPORT_CONFIG.contactEmail, tM("mailSubject"));
  return (
    <MarketingShell serverYear={serverYear}>
      <PageIntro title={tM("contactTitle")} sub={tM("contactSub")} />
      <section aria-label={tM("navContact")} className={marketingSection}>
        <ul className="mx-auto grid max-w-[960px] grid-cols-[minmax(0,1fr)] gap-4 medium:grid-cols-2 regular:gap-6">
          <Card Icon={AlertIcon} title={tM("issueTitle")} body={tM("issueBody")}>
            {mail ? (
              <a href={mail} className={textLink}>
                {SUPPORT_CONFIG.contactEmail}
              </a>
            ) : (
              <a href={`${repo}/issues/new`} {...external} className={textLink}>
                {tM("issueCta")}
                <ArrowRight size={20} aria-hidden="true" />
              </a>
            )}
          </Card>
          <Card Icon={CodeIcon} title={tM("ideaTitle")} body={tM("ideaBody")}>
            <a href={repo} {...external} className={textLink}>
              {tM("ideaCta")}
              <ArrowRight size={20} aria-hidden="true" />
            </a>
          </Card>
          <Card Icon={HeartIcon} title={tM("helpTitle")} body={tM("helpBody")}>
            <Link href="/support" className={textLink}>
              {tM("helpCta")}
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          </Card>
        </ul>
      </section>
    </MarketingShell>
  );
}
