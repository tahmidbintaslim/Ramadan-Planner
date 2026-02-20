import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  Moon,
  CalendarDays,
  Bell,
  BookOpen,
  Brain,
  Calculator,
  CircleOff,
  HandHeart,
  Hand,
  Library,
  Target,
  Globe,
  Shield,
  Wallet,
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
import { RamadanTimetable } from "@/components/landing/ramadan-timetable";
import { AppHeader } from "@/components/layout/app-header";
import { formatLocalizedNumber } from "@/lib/locale-number";

export default async function LandingPage() {
  const locale = await getLocale();
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");

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
      icon: CalendarDays,
      title: t("featureTimetable"),
      description: t("featureTimetableDesc"),
    },
    {
      icon: Library,
      title: t("featureBooks"),
      description: t("featureBooksDesc"),
    },
    {
      icon: HandHeart,
      title: t("featureDuas"),
      description: t("featureDuasDesc"),
    },
    {
      icon: Hand,
      title: t("featureTasbih"),
      description: t("featureTasbihDesc"),
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
      icon: Brain,
      title: t("featureQuiz"),
      description: t("featureQuizDesc"),
    },
    {
      icon: CalendarDays,
      title: t("featureCalendar"),
      description: t("featureCalendarDesc"),
    },
    {
      icon: Calculator,
      title: t("featureZakat"),
      description: t("featureZakatDesc"),
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
      num: t("step1Num"),
      title: t("step1Title"),
      desc: t("step1Desc"),
    },
    {
      num: t("step2Num"),
      title: t("step2Title"),
      desc: t("step2Desc"),
    },
    {
      num: t("step3Num"),
      title: t("step3Title"),
      desc: t("step3Desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <AppHeader />

      <main id="main-content">
        <section
          className="relative overflow-hidden py-14 sm:py-20 lg:py-24"
          aria-labelledby="hero-title"
        >
          <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-background via-accent/10 to-background" />
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_65%)]" />

          <div className="container mx-auto px-4">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
              <div className="space-y-5 sm:space-y-6 text-center lg:text-left">
                <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                    <Star className="mr-1.5 h-3 w-3" />
                    {t("freeForever")}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 text-sm">
                    {t("madeForBD")}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 text-sm">
                    {t("worldwide")}
                  </Badge>
                </div>

                <h1
                  id="hero-title"
                  className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                >
                  {t("heroTitle")}
                </h1>
                <p className="reading-copy mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg md:text-xl lg:mx-0">
                  {t("heroSubtitle")}
                </p>

                <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Button
                    size="lg"
                    asChild
                    className="tap-target motion-spring w-full px-7 py-3 text-base shadow-md shadow-primary/30 sm:w-auto sm:text-lg"
                  >
                    <Link href="/dashboard">
                      {t("getStarted")}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="tap-target motion-spring w-full px-6 py-3 text-base sm:w-auto sm:text-lg"
                  >
                    <Link href="#live-demo">{t("exploreApp")}</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <Link
                    href="#prayer-times"
                    className="tap-target surface-soft motion-spring inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/40 lg:justify-start"
                  >
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{t("prayerTimesTitle")}</span>
                  </Link>
                  <Link
                    href="#quran"
                    className="tap-target surface-soft motion-spring inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/40 lg:justify-start"
                  >
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>{t("quranTitle")}</span>
                  </Link>
                  <Link
                    href="#features"
                    className="tap-target surface-soft motion-spring inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/40 lg:justify-start"
                  >
                    <Target className="h-4 w-4 text-primary" />
                    <span>{t("features")}</span>
                  </Link>
                </div>
              </div>

              <Card className="surface-soft motion-reveal overflow-hidden border-primary/20 bg-card/85 backdrop-blur-sm">
                <CardContent className="mobile-comfy relative space-y-4 pt-6">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-16 left-4 h-36 w-36 rounded-full bg-accent/60 blur-2xl" />

                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {tCommon("appName")}
                    </p>
                    <h2 className="text-xl font-semibold">{t("exploreApp")}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {t("featureTrackingDesc")}
                    </p>
                  </div>

                  <div className="relative mx-auto h-[300px] w-full max-w-[380px] overflow-hidden rounded-2xl border border-emerald-200/70 bg-linear-to-br from-emerald-100/60 via-card to-emerald-200/55 p-3 shadow-inner">
                    <div className="absolute inset-3 rounded-xl border border-white/45" />
                    <svg
                      viewBox="0 0 360 280"
                      className="h-full w-full scale-[1.03]"
                      role="img"
                      aria-label={t("heroIllustrationLabel")}
                    >
                      <defs>
                        <linearGradient id="archBg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#dff4ee" />
                          <stop offset="100%" stopColor="#b9e3d8" />
                        </linearGradient>
                        <pattern
                          id="heroLines"
                          width="12"
                          height="12"
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(30)"
                        >
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="12"
                            stroke="#17804f22"
                            strokeWidth="2"
                          />
                        </pattern>
                      </defs>

                      <rect
                        x="0"
                        y="0"
                        width="360"
                        height="280"
                        rx="18"
                        fill="#edf7f3"
                        opacity="0.35"
                      />
                      <rect
                        x="0"
                        y="0"
                        width="360"
                        height="280"
                        rx="18"
                        fill="url(#heroLines)"
                      />

                      <g className="sway-slow">
                        <line
                          x1="70"
                          y1="6"
                          x2="70"
                          y2="48"
                          stroke="#4f7c6d"
                          strokeWidth="2"
                          opacity="0.7"
                        />
                        <rect
                          x="56"
                          y="48"
                          width="28"
                          height="36"
                          rx="6"
                          fill="#f4cd5c"
                          stroke="#769b8f"
                        />
                      </g>
                      <g
                        className="sway-slow"
                        style={{ animationDelay: "0.8s" }}
                      >
                        <line
                          x1="290"
                          y1="6"
                          x2="290"
                          y2="48"
                          stroke="#4f7c6d"
                          strokeWidth="2"
                          opacity="0.7"
                        />
                        <rect
                          x="276"
                          y="48"
                          width="28"
                          height="36"
                          rx="6"
                          fill="#f4cd5c"
                          stroke="#769b8f"
                        />
                      </g>

                      <g className="float-slow">
                        <path
                          d="M110 236 L110 126 Q180 44 250 126 L250 236"
                          fill="url(#archBg)"
                          stroke="#8ab6aa"
                          strokeWidth="4"
                        />
                        <circle
                          cx="180"
                          cy="116"
                          r="32"
                          fill="#f4fbf8"
                          stroke="#8ab6aa"
                        />
                        <path
                          d="M191 100a14 14 0 1 0 7 25a11 11 0 1 1 -7 -25z"
                          fill="#17804f"
                        />
                        <rect
                          x="136"
                          y="170"
                          width="88"
                          height="42"
                          rx="8"
                          fill="#ffffffb8"
                          stroke="#8ab6aa"
                        />
                        <path
                          d="M177 182h6v10h-6zM171 182h18"
                          stroke="#17804f"
                          strokeWidth="2"
                        />
                        <text
                          x="180"
                          y="206"
                          textAnchor="middle"
                          fontSize="11"
                          fill="#2b4c40"
                        >
                          Read the Quran
                        </text>
                      </g>
                    </svg>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-center text-xs">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {t("featurePrayer")}
                    </div>
                    <div className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-center text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      {t("featureTracking")}
                    </div>
                    <div className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-center text-xs">
                      <Bell className="h-3.5 w-3.5 text-primary" />
                      {t("featureReminders")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          className="container mx-auto px-4 pb-6 sm:pb-8"
          aria-labelledby="quick-actions-title"
        >
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="space-y-1 text-center">
              <h2
                id="quick-actions-title"
                className="text-xl font-bold sm:text-2xl"
              >
                {t("learnMore")}
              </h2>
              <p className="reading-copy text-sm leading-6 text-muted-foreground">
                {t("whyDesc")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
              <Link
                href="/today"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureTracking")}
              >
                <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureTracking")}
                </p>
              </Link>
              <Link
                href="/reminders"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureReminders")}
              >
                <Bell className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureReminders")}
                </p>
              </Link>
              <Link
                href="/plan"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureGoals")}
              >
                <Target className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureGoals")}
                </p>
              </Link>
              <Link
                href="/quran"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureQuran")}
              >
                <BookOpen className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureQuran")}
                </p>
              </Link>
              <Link
                href="/books"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureBooks")}
              >
                <Library className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureBooks")}
                </p>
              </Link>
              <Link
                href="/today"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureDuas")}
              >
                <HandHeart className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureDuas")}
                </p>
              </Link>
              <Link
                href="/tasbih"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureTasbih")}
              >
                <Hand className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureTasbih")}
                </p>
              </Link>
              <Link
                href="/quiz"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureQuiz")}
              >
                <Brain className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureQuiz")}
                </p>
              </Link>
              <Link
                href="/zakat"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureZakat")}
              >
                <Calculator className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureZakat")}
                </p>
              </Link>
              <Link
                href="#timetable"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureTimetable")}
              >
                <Clock className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureTimetable")}
                </p>
              </Link>
              <Link
                href="#timetable"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureCalendar")}
              >
                <CalendarDays className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureCalendar")}
                </p>
              </Link>
              <Link
                href="/settings"
                className="tap-target mobile-comfy surface-soft motion-spring rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
                aria-label={t("featureBilingual")}
              >
                <Globe className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-[0.95rem] font-medium leading-snug">
                  {t("featureBilingual")}
                </p>
              </Link>
            </div>
          </div>
        </section>

        <section
          id="live-demo"
          className="scroll-mt-24 container mx-auto px-4 py-12 sm:py-16"
        >
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {t("exploreApp")}
              </h2>
              <p className="reading-copy text-muted-foreground">
                {t("whyDesc")}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card
                id="prayer-times"
                className="scroll-mt-24 surface-soft motion-reveal border-primary/20"
              >
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">
                      {t("prayerTimesTitle")}
                    </h3>
                    <Badge variant="outline">{t("featurePrayer")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("prayerTimesDesc")}
                  </p>
                  <PrayerTimesWidget />
                </CardContent>
              </Card>

              <Card
                id="quran"
                className="scroll-mt-24 surface-soft motion-reveal border-primary/20"
              >
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">{t("quranTitle")}</h3>
                    <Badge variant="outline">{t("featureQuran")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("quranDesc")}
                  </p>
                  <QuranPreview />
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">
                      {t("featureBooks")}
                    </h3>
                    <Badge variant="outline">{t("featureBooks")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureBooksDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Library className="h-4 w-4 text-primary" />
                      <span>{t("booksItemSeerah")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Library className="h-4 w-4 text-primary" />
                      <span>{t("booksItemAqeedah")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Library className="h-4 w-4 text-primary" />
                      <span>{t("booksItemCharacter")}</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/books">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">
                      {t("featureDuas")}
                    </h3>
                    <Badge variant="outline">{t("featureDuas")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureDuasDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <HandHeart className="h-4 w-4 text-primary" />
                      <span>{t("duasItemRabbana")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HandHeart className="h-4 w-4 text-primary" />
                      <span>{t("duasItemMorningEvening")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HandHeart className="h-4 w-4 text-primary" />
                      <span>{t("duasItemShareable")}</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/today">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {t("features")}
              </h2>
              <p className="reading-copy text-muted-foreground">
                {t("exploreApp")}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureTracking")}
                    </h3>
                    <Badge variant="outline">{t("featureTracking")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureTrackingDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{t("trackingItemSalah")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{t("trackingItemQuran")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{t("trackingItemReflection")}</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/today">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureGoals")}
                    </h3>
                    <Badge variant="outline">{t("featureGoals")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureGoalsDesc")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border/70 bg-background/60 p-2">
                      {t("goalsChipKhatm")}
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/60 p-2">
                      {t("goalsChipSadaqah")}
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/60 p-2">
                      {t("goalsChipTahajjud")}
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/60 p-2">
                      {t("goalsChipDua")}
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/plan">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureReminders")}
                    </h3>
                    <Badge variant="outline">{t("featureReminders")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureRemindersDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{t("reminderItemSehri")}</span>
                      <span className="text-muted-foreground">-15 min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("reminderItemIftar")}</span>
                      <span className="text-muted-foreground">
                        {t("reminderItemOnTime")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("reminderItemQuran")}</span>
                      <span className="text-muted-foreground">
                        {t("reminderItemAfterMaghrib")}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/reminders">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureCalendar")}
                    </h3>
                    <Badge variant="outline">{t("featurePrivacy")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureCalendarDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span>{t("calendarItemGoogleSync")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span>{t("calendarItemIcsFeed")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>{t("featurePrivacyDesc")}</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/settings">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20 lg:col-span-2">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureQuiz")}
                    </h3>
                    <Badge variant="outline">{t("featureQuiz")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureQuizDesc")}
                  </p>
                  <div className="grid gap-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm sm:grid-cols-3">
                    <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
                      {t("quizTopicAqidah")}
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
                      {t("quizTopicSalahFiqh")}
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
                      {t("quizTopicQuranReflection")}
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/quiz">{t("getStarted")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureTasbih")}
                    </h3>
                    <Badge variant="outline">{t("featureTasbih")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureTasbihDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{t("tasbihWordSubhanAllah")}</span>
                      <span className="text-muted-foreground">33</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("tasbihWordAlhamdulillah")}</span>
                      <span className="text-muted-foreground">33</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("tasbihWordAllahuAkbar")}</span>
                      <span className="text-muted-foreground">34</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/tasbih">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-reveal border-primary/20">
                <CardContent className="mobile-comfy space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {t("featureZakat")}
                    </h3>
                    <Badge variant="outline">{t("featureZakat")}</Badge>
                  </div>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {t("featureZakatDesc")}
                  </p>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{t("zakatLineAssetsExpr")}</span>
                      <span className="text-muted-foreground">
                        {t("zakatLineAssetsLabel")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("zakatLineDebtsExpr")}</span>
                      <span className="text-muted-foreground">
                        {t("zakatLineDebtsLabel")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("zakatLineDueExpr")}</span>
                      <span className="text-muted-foreground">
                        {t("zakatLineDueLabel")}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/zakat">{t("learnMore")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-24 bg-accent/20 py-12 sm:py-16"
        >
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-10 max-w-3xl space-y-2 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {t("features")}
              </h2>
              <p className="text-muted-foreground">{t("whyDesc")}</p>
            </div>

            <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, idx) => (
                <Card
                  key={feature.title}
                  className="surface-soft motion-spring motion-reveal transition-shadow hover:shadow-md"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <CardContent className="space-y-3 pt-6">
                    <div className="w-fit rounded-lg bg-primary/10 p-2.5">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="reading-copy text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {t("benefitsTitle")}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="surface-soft motion-spring border-primary/20">
                <CardContent className="space-y-3 pt-6">
                  <div className="w-fit rounded-lg bg-primary/10 p-2.5">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">
                    {t("benefitPrivacyTitle")}
                  </h3>
                  <p className="reading-copy text-sm leading-relaxed text-muted-foreground">
                    {t("benefitPrivacyDesc")}
                  </p>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-spring border-primary/20">
                <CardContent className="space-y-3 pt-6">
                  <div className="w-fit rounded-lg bg-primary/10 p-2.5">
                    <CircleOff className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">
                    {t("benefitNoAdsTitle")}
                  </h3>
                  <p className="reading-copy text-sm leading-relaxed text-muted-foreground">
                    {t("benefitNoAdsDesc")}
                  </p>
                </CardContent>
              </Card>

              <Card className="surface-soft motion-spring border-primary/20">
                <CardContent className="space-y-3 pt-6">
                  <div className="w-fit rounded-lg bg-primary/10 p-2.5">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">
                    {t("benefitFreeTitle")}
                  </h3>
                  <p className="reading-copy text-sm leading-relaxed text-muted-foreground">
                    {t("benefitFreeDesc")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          id="timetable"
          className="container mx-auto px-4 py-12 sm:py-16"
        >
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {t("ramadanTimingsTitle", {
                  year: formatLocalizedNumber(1447, locale),
                })}
              </h2>
              <p className="reading-copy text-muted-foreground">
                {t("ramadanTimingsDesc")}
              </p>
            </div>
            <RamadanTimetable />
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        <section className="container mx-auto px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl space-y-8">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              {t("howItWorksTitle")}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className="surface-soft motion-spring space-y-3 rounded-xl border border-border/70 bg-card/50 p-4 text-center"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {step.num}
                  </div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="reading-copy text-sm text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary py-12 text-primary-foreground sm:py-16">
          <div className="container mx-auto space-y-6 px-4 text-center">
            <div className="mx-auto max-w-2xl space-y-4">
              <Moon className="mx-auto h-10 w-10 opacity-80" />
              <h2 className="text-2xl font-bold sm:text-3xl">
                {t("ctaTitle")}
              </h2>
              <p className="reading-copy leading-relaxed font-bold !text-white dark:!text-primary-foreground">
                {t("ctaDesc")}
              </p>
            </div>
            <Button size="lg" variant="secondary" asChild className="min-w-48">
              <Link href="/dashboard">
                {t("ctaButton")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card py-8">
        <div className="container mx-auto space-y-2 px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Moon className="h-4 w-4 text-primary" />
            <span>{t("footerTagline")}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {tCommon("appName")}
          </p>
        </div>
      </footer>
    </div>
  );
}
