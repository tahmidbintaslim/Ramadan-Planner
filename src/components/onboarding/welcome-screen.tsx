import { track } from "@/lib/track";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/icons/brand-mark";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";
import { useLocaleSwitch } from "@/components/layout/shell-actions";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { defaultLocation, markOnboardingDone, writeStoredLocation, type StoredLocation } from "@/lib/user-location";
import { LocationPickerFields, useLocationPicker } from "./location-picker";
import { WELCOME_CARD_KEY } from "./welcome-card";

const route = getRouteApi("/welcome");

const backClass =
  "-ml-3 flex size-11 items-center justify-center rounded-rp-full text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus";

/**
 * First-run onboarding in two steps, no sign-up (Figma page 14, section 5 "Onboarding v2"): the welcome with the
 * two language buttons, each in its own language, then the place. Tapping a popular district finishes at once;
 * "Not now" uses Dhaka. The choice is stored on this device only (see `@/lib/user-location`); Today then shows a
 * one-time welcome card. Each step is its own history entry (`?step=location`).
 */
export function WelcomeScreen() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const locale = useLocale() === "en" ? "en" : "bn";
  const router = useRouter();
  const { switchLocale, isPending } = useLocaleSwitch();
  const step = route.useSearch().step === "location" ? "location" : "welcome";
  const toLocation = () => void router.navigate({ to: "/welcome", search: { step: "location" } });

  function finish(loc: StoredLocation) {
    track("location_set");
    writeStoredLocation(loc);
    markOnboardingDone();
    try {
      localStorage.setItem(WELCOME_CARD_KEY, "1");
    } catch {
      // No storage: Today simply shows no welcome card.
    }
    // Replace the step entry: back from Today must not land inside a finished onboarding.
    void router.navigate({ to: "/today", replace: true });
  }
  const picker = useLocationPicker({ onSubmit: finish, submitOnRowTap: true });

  function confirm() {
    const loc = picker.resolve();
    if (loc) finish(loc);
  }

  if (step === "welcome") {
    const langs = [
      { lang: "bn", label: t("startBn") },
      { lang: "en", label: t("startEn") },
    ] as const;
    return (
      <div className="min-h-dvh bg-rp-page">
        <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 medium:px-6">
          <div className="flex h-11 items-center justify-end">
            <TextThemeButton className="-mr-2" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <span aria-hidden="true" className="rp-pop mb-3 flex size-24 items-center justify-center rounded-[28px] bg-rp-live text-rp-on-live">
              <BrandMark size={56} />
            </span>
            <h1 className="rp-large-title text-rp-ink">{tCommon("appName")}</h1>
            <p className="rp-body max-w-[320px] text-rp-muted">{t("welcomeTagline")}</p>
          </div>
          <div className="flex flex-col gap-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* The current language first and filled; the other one switches, then continues. */}
            {[...langs].sort((a) => (a.lang === locale ? -1 : 1)).map(({ lang, label }) => (
              <Button
                key={lang}
                size="lg"
                lang={lang}
                variant={lang === locale ? "primary" : "soft"}
                disabled={isPending}
                className="w-full"
                onClick={() => {
                  if (lang !== locale) switchLocale();
                  toLocation();
                }}
              >
                {label}
              </Button>
            ))}
            <p className="rp-caption text-center text-rp-muted">{t("welcomeNote")}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-rp-page">
      <main id="main-content" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 medium:px-6">
        <div className="flex h-11 items-center justify-between">
          <button
            type="button"
            onClick={() => (router.history.canGoBack() ? router.history.back() : void router.navigate({ to: "/welcome" }))}
            aria-label={tCommon("back")}
            className={backClass}
          >
            <ChevronLeft size={24} strokeWidth={LUCIDE_STROKE} aria-hidden />
          </button>
          <TextThemeButton className="-mr-2" />
        </div>
        <div className="flex flex-col gap-2 pt-2 pb-6">
          <h1 className="rp-large-title text-rp-ink">{t("title")}</h1>
          <p className="rp-body text-rp-muted">{t("subtitle")}</p>
        </div>
        <LocationPickerFields picker={picker} />
        <p className="rp-caption pt-3 text-center text-rp-accent">{t("tapHint")}</p>
        {/* Scrolls with the list: in the sticky bar it hid most of the districts on a phone. */}
        <p className="rp-caption pt-2 text-center text-rp-muted">{t("privacyNote")}</p>
        <div className="sticky bottom-0 mt-auto flex flex-col gap-1 bg-rp-page pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <Button size="lg" className="w-full" onClick={confirm}>
            {t("start")}
          </Button>
          <Button variant="quiet" className="h-auto min-h-11 w-full whitespace-normal py-2" onClick={() => finish(defaultLocation())}>
            {t("later")}
          </Button>
        </div>
      </main>
    </div>
  );
}
