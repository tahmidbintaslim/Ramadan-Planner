"use client";

import { useSyncExternalStore } from "react";
import { useMatches } from "@tanstack/react-router";
import { Show, UserButton } from "@clerk/tanstack-react-start";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { BellIcon } from "@/components/icons/islamic-icons";
import { useRamadanDay } from "@/hooks/use-shell-day";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { cn } from "@/lib/utils";
import type { NavLabelKey } from "./nav-items";
import { GuestAuthButtons, LanguageButton, roundButtonClass } from "./shell-actions";

// Greeting top bar: in page flow, transparent on the page background. Left: the greeting (Tiro Bangla 24/34) or the
// route's title, and a caption line (weekday · date · "Fast N" during Ramadan). Right: a round Bell button to
// Reminders, the Clerk user menu when signed in, and (desktop) the language switch and guest sign-in. On mobile the
// language switch and sign-in live in the bottom nav's "More" sheet.

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** nav.* key shown in the top bar instead of the greeting. */
    shellTitle?: NavLabelKey;
  }
}

const subscribeNoop = () => () => {};

/** "Tuesday · 3 November" in the active locale (Bengali digits for bn). Client-only: it depends on the device clock. */
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

export function AppHeader() {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const titleKey = useMatches({
    select: (matches) => [...matches].reverse().find((m) => m.staticData?.shellTitle)?.staticData.shellTitle,
  });
  const caption = useTodayCaption(locale);
  const ramadanDay = useRamadanDay();
  const fastLabel = ramadanDay ? t("fastDay", { day: formatLocalizedNumber(ramadanDay, locale) }) : null;

  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 md:px-6 lg:px-8 lg:pt-6">
      <div className="min-w-0">
        <p className={cn("rp-greeting text-rp-ink", titleKey && "truncate")}>
          {titleKey ? tNav(titleKey) : t("greeting")}
        </p>
        {/* Reserve the caption line before mount so the layout does not shift. */}
        <p className="rp-small min-h-[22px] text-rp-muted">
          {caption}
          {caption && fastLabel ? ` · ${fastLabel}` : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <LanguageButton className="hidden lg:inline-flex" />
        <Link href="/reminders" aria-label={tNav("reminders")} className={roundButtonClass}>
          <BellIcon size={22} aria-hidden />
        </Link>
        <Show when="signed-in">
          <span className="flex size-11 items-center justify-center rounded-full bg-rp-surface shadow-rp-soft">
            <UserButton />
          </span>
        </Show>
        <GuestAuthButtons className="hidden lg:flex" />
      </div>
    </header>
  );
}
