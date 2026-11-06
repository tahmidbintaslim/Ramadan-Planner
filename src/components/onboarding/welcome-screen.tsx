import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/shared/link";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";
import { LanguageSegmented } from "@/components/layout/shell-actions";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { PrayerHero } from "@/components/prayer/prayer-hero";
import { useLiveTimes } from "@/components/today/use-live-times";
import { defaultLocation, markOnboardingDone, writeStoredLocation, type StoredLocation } from "@/lib/user-location";
import { LocationPickerFields, useLocationPicker } from "./location-picker";

type Step = "language" | "location";

const backClass =
  "-ml-3 flex size-11 items-center justify-center rounded-rp-full text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus";

/**
 * First-run onboarding (v4 welcome steps 3 and 4; no sign-up): choose the language (with a live preview of the
 * next-prayer card), then the district. The choice is stored on this device only (see `@/lib/user-location`) and
 * Today uses it for its times. Each step: a 44 nav bar (back, Text & Theme), a Large Title, the content, and the
 * 56 primary action in the lower part of the screen.
 */
export function WelcomeScreen() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState<Step>("language");
  const { phaseTimings, timeZone } = useLiveTimes();

  function finish(loc: StoredLocation) {
    writeStoredLocation(loc);
    markOnboardingDone();
    void router.navigate({ to: "/today" });
  }
  const picker = useLocationPicker({ onSubmit: finish });

  function confirm() {
    const loc = picker.resolve();
    if (loc) finish(loc);
  }

  return (
    <div className="min-h-dvh bg-rp-page">
      <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 medium:px-6">
        <div className="flex h-11 items-center justify-between">
          {step === "language" ? (
            <Link href="/" aria-label={tCommon("back")} className={backClass}>
              <ChevronLeft size={24} strokeWidth={LUCIDE_STROKE} aria-hidden />
            </Link>
          ) : (
            <button type="button" onClick={() => setStep("language")} aria-label={tCommon("back")} className={backClass}>
              <ChevronLeft size={24} strokeWidth={LUCIDE_STROKE} aria-hidden />
            </button>
          )}
          <TextThemeButton className="-mr-2" />
        </div>

        {step === "language" ? (
          <>
            <div className="flex flex-col gap-2 pt-2 pb-6">
              <h1 className="rp-large-title text-rp-ink">{t("languageTitle")}</h1>
              <p className="rp-body text-rp-muted">{t("languageSubtitle")}</p>
            </div>
            <LanguageSegmented className="w-full" />
            {phaseTimings ? (
              <section aria-labelledby="welcome-preview" className="mt-8 flex flex-col gap-2">
                <h2 id="welcome-preview" className="rp-headline text-rp-ink">
                  {t("preview")}
                </h2>
                <PrayerHero timings={phaseTimings} timeZone={timeZone} />
              </section>
            ) : null}
            <div className="mt-auto pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <Button size="lg" className="w-full" onClick={() => setStep("location")}>
                {t("continue")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 pt-2 pb-6">
              <h1 className="rp-large-title text-rp-ink">{t("title")}</h1>
              <p className="rp-body text-rp-muted">{t("subtitle")}</p>
            </div>
            <LocationPickerFields picker={picker} />
            <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-rp-page pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button size="lg" className="w-full" onClick={confirm}>
                {t("start")}
              </Button>
              <Button
                variant="quiet"
                className="h-auto min-h-11 w-full whitespace-normal py-2"
                onClick={() => finish(defaultLocation())}
              >
                {t("later")}
              </Button>
              <p className="rp-caption text-center text-rp-muted">{t("privacyNote")}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
