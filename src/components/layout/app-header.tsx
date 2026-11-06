"use client";

import { useState, useSyncExternalStore } from "react";
import { useMatches } from "@tanstack/react-router";
import { ChevronDown, MapPin, User } from "lucide-react";
import { Show, UserButton } from "@clerk/tanstack-react-start";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";
import { LocationSheet } from "@/components/onboarding/location-sheet";
import { useRamadanDay } from "@/hooks/use-shell-day";
import { useStoredLocation } from "@/hooks/use-stored-location";
import { districtById, districtName } from "@/lib/districts";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { cn } from "@/lib/utils";
import { LUCIDE_STROKE, type NavLabelKey } from "./nav-items";
import { RemindersButton, roundButtonClass } from "./shell-actions";

// The app's bars (v4).
// Compact / medium (below 835px), a 56 nav header: the date line (Footnote, secondary) over the location button
// (Title 2 + chevron, opens the location sheet) on Today, or the route's title elsewhere; trailing Text & Theme and
// Reminders, 44 each, and the Clerk menu when signed in.
// Regular, a 56 toolbar with a hairline rule: the location pill (tonal, 44), the date, then Text & Theme,
// Reminders and the account, 44 each, 48 side margins.

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** nav.* key shown in the header instead of the location. */
    shellTitle?: NavLabelKey;
  }
}

const subscribeNoop = () => () => {};

/** "শনিবার · ২০ ফেব্রুয়ারি" in the active locale. Client-only: it depends on the device clock. */
function useTodayCaption(locale: string): string | null {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return null;
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const now = new Date();
  try {
    const weekday = new Intl.DateTimeFormat(tag, { weekday: "long" }).format(now);
    const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long" }).format(now);
    return `${weekday} · ${date}`;
  } catch {
    return null;
  }
}

/** The district chosen on this device, in the UI language (null before mount or when none is stored). */
export function useDistrictLabel(): string | null {
  const locale = useLocale();
  const stored = useStoredLocation();
  const d = districtById(stored?.districtId);
  return d ? districtName(d, locale) : null;
}

function AccountButton() {
  const tAuth = useTranslations("auth");
  return (
    <>
      <Show when="signed-in">
        <span className="flex size-11 items-center justify-center">
          <UserButton />
        </span>
      </Show>
      <Show when="signed-out">
        <Link href="/sign-in" aria-label={tAuth("login")} className={roundButtonClass}>
          <span className="flex size-8 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
            <User size={18} strokeWidth={LUCIDE_STROKE} aria-hidden />
          </span>
        </Link>
      </Show>
    </>
  );
}

export function AppHeader() {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const tPrayer = useTranslations("prayer");
  const locale = useLocale();
  const titleKey = useMatches({
    select: (matches) => [...matches].reverse().find((m) => m.staticData?.shellTitle)?.staticData.shellTitle,
  });
  const caption = useTodayCaption(locale);
  const ramadanDay = useRamadanDay();
  const fastLabel = ramadanDay ? t("fastDay", { day: formatLocalizedNumber(ramadanDay, locale) }) : null;
  const dateLine = caption ? (fastLabel ? `${caption} · ${fastLabel}` : caption) : null;
  const district = useDistrictLabel();
  const [sheetOpen, setSheetOpen] = useState(false);
  const placeLabel = district ?? t("chooseLocation");

  return (
    <header>
      {/* Compact / medium nav header. */}
      <div className="flex min-h-14 items-center pt-2 pr-1.5 pl-4 medium:pl-6 medium:pr-4 regular:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Reserve the date line before mount so the layout does not shift. */}
          <p className="rp-caption min-h-5 truncate text-rp-muted" data-testid="header-date">
            {dateLine}
          </p>
          {titleKey ? (
            <p className="rp-greeting truncate text-rp-ink">{tNav(titleKey)}</p>
          ) : (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              data-testid="today-location"
              aria-label={tPrayer("locationChange", { district: placeLabel })}
              className="-ml-1 flex min-h-11 max-w-full items-center gap-1 self-start rounded-rp-sm px-1 text-rp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
            >
              <span aria-hidden="true" className="rp-greeting truncate" suppressHydrationWarning>
                {placeLabel}
              </span>
              <ChevronDown size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0" />
            </button>
          )}
        </div>
        <TextThemeButton />
        <RemindersButton />
        <Show when="signed-in">
          <span className="flex size-11 items-center justify-center">
            <UserButton />
          </span>
        </Show>
      </div>

      {/* Regular toolbar. */}
      <div className="hidden h-14 items-center gap-2 border-b border-rp-rule bg-rp-page px-12 regular:flex">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={tPrayer("locationChange", { district: placeLabel })}
          className="flex h-11 shrink-0 items-center gap-1 rounded-rp-input bg-rp-accent-tint px-3 text-rp-accent transition-colors hover:bg-rp-accent-tint/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
        >
          <MapPin size={16} strokeWidth={LUCIDE_STROKE} aria-hidden />
          <span aria-hidden="true" className="rp-caption" suppressHydrationWarning>
            {placeLabel}
          </span>
          <ChevronDown size={16} strokeWidth={LUCIDE_STROKE} aria-hidden />
        </button>
        <p className={cn("rp-small min-w-0 flex-1 truncate text-rp-muted")}>{dateLine}</p>
        <TextThemeButton />
        <RemindersButton />
        <AccountButton />
      </div>

      <LocationSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </header>
  );
}
