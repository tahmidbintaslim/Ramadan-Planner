import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  Moon,
  CalendarDays,
  Bell,
  BookOpen,
  Target,
  Globe,
  Shield,
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PrayerTimesWidget } from "@/components/landing/prayer-times-widget";
import { QuranPreview } from "@/components/landing/quran-preview";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");
  const tAuth = await getTranslations("auth");

  const features = [
    {
      icon: CheckCircle2,
      title: t("featureTracking"),
      description: t("featureTrackingDesc"),
    },
    {
      icon: Clock,
      title: t("featurePrayer"),
      description: t("featurePrayerDesc"),
    },
    {
      icon: BookOpen,
      title: t("featureQuran"),
      description: t("featureQuranDesc"),
    },
    {
      icon: Target,
      title: t("featureGoals"),
      description: t("featureGoalsDesc"),
    },
    {
      icon: Bell,
      title: t("featureReminders"),
      description: t("featureRemindersDesc"),
    },
    {
      icon: CalendarDays,
      title: t("featureCalendar"),
      description: t("featureCalendarDesc"),
    },
    {
      icon: Globe,
      title: t("featureBilingual"),
      description: t("featureBilingualDesc"),
    },
    {
      icon: Shield,
      title: t("featurePrivacy"),
      description: t("featurePrivacyDesc"),
    },
  ];

  const steps = [
    {
      num: "১",
      title: t("step1Title"),
      desc: t("step1Desc"),
    },
    {
      num: "২",
      title: t("step2Title"),
      desc: t("step2Desc"),
    },
    {
      num: "৩",
      title: t("step3Title"),
      desc: t("step3Desc"),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Moon className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-primary">
              {tCommon("appName")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">{t("exploreApp")}</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">{tAuth("login")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">{tAuth("signup")}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-accent/30 to-background" />
        <div className="container relative mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                {t("freeForever")}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {t("madeForBD")}
              </Badge>
              <Badge variant="outline" className="text-xs">
                🌍 {t("worldwide")}
              </Badge>
            </div>

            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Moon className="h-12 w-12 text-primary" />
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild className="min-w-48">
                <Link href="/dashboard">
                  {t("getStarted")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="min-w-48">
                <Link href="#features">{t("learnMore")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Prayer Times (Live) ─── */}
      <section
        className="container mx-auto px-4 py-12 sm:py-16"
        id="prayer-times"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {t("prayerTimesTitle")}
            </h2>
            <p className="text-muted-foreground">{t("prayerTimesDesc")}</p>
          </div>
          <PrayerTimesWidget />
        </div>
      </section>

      <Separator className="max-w-4xl mx-auto" />

      {/* ─── Why Ramadan Planner ─── */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("whyTitle")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("whyDesc")}
          </p>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="bg-accent/20 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10 sm:text-3xl">
            {t("features")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="pt-6 space-y-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Quran Section ─── */}
      <section className="container mx-auto px-4 py-12 sm:py-16" id="quran">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {t("quranTitle")}
            </h2>
          </div>
          <QuranPreview />
        </div>
      </section>

      <Separator className="max-w-4xl mx-auto" />

      {/* ─── How It Works ─── */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="text-2xl font-bold text-center sm:text-3xl">
            {t("howItWorksTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={i} className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  {step.num}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-primary text-primary-foreground py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center space-y-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <Moon className="h-10 w-10 mx-auto opacity-80" />
            <h2 className="text-2xl font-bold sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="opacity-90 leading-relaxed">{t("ctaDesc")}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" variant="secondary" asChild className="min-w-48">
              <Link href="/dashboard">
                {t("ctaButton")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card py-8">
        <div className="container mx-auto px-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Moon className="h-4 w-4 text-primary" />
            <span>{t("footerTagline")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {tCommon("appName")}
          </p>
        </div>
      </footer>
    </div>
  );
}
