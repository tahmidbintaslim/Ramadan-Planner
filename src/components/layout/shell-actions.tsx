"use client";

import { useTransition } from "react";
import { useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { LoginIcon, UserAddIcon } from "@/components/icons/islamic-icons";
import { Show } from "@clerk/tanstack-react-start";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { switchLocaleAction } from "@/actions/locale";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LUCIDE_STROKE } from "./nav-items";

/** Toggles bn/en and re-runs the root loader so the new locale's messages render. */
export function useLocaleSwitch() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const switchLocale = () => {
    startTransition(async () => {
      await switchLocaleAction();
      // A ?lang= in the URL would keep forcing the old language: drop it, then reload the messages.
      if (new URLSearchParams(window.location.search).has("lang")) {
        await router.navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, lang: undefined }), replace: true });
      }
      await router.invalidate();
    });
  };
  return { switchLocale, isPending };
}

/** 44×44 icon button (HIG hit area) for bar actions: a 24 (or 20) glyph optically centred, no chrome. */
export const roundButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-rp-full text-rp-ink transition-colors hover:bg-rp-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus disabled:opacity-50";

/**
 * The language segmented control (বাংলা | English): 44 tall, radius 12 = 10 + 2 inset, the selected segment on the
 * surface. Each segment is labelled in its own language.
 */
export function LanguageSegmented({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const { switchLocale, isPending } = useLocaleSwitch();
  const options = [
    { value: "bn", label: "বাংলা" },
    { value: "en", label: "English" },
  ] as const;
  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className={cn("inline-grid h-11 grid-cols-2 rounded-rp-input bg-rp-accent-tint p-0.5", className)}
    >
      {options.map((o) => {
        const selected = locale.startsWith(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            lang={o.value}
            aria-checked={selected}
            disabled={isPending}
            onClick={() => {
              if (!selected) switchLocale();
            }}
            className={cn(
              "rp-callout min-w-[88px] rounded-rp-sm px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
              selected ? "bg-rp-surface font-semibold text-rp-ink shadow-rp-soft" : "text-rp-muted hover:text-rp-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The bell: Reminders (44 hit, lucide bell). */
export function RemindersButton({ className }: { className?: string }) {
  const tNav = useTranslations("nav");
  return (
    <Link href="/reminders" aria-label={tNav("reminders")} className={cn(roundButtonClass, className)}>
      <Bell size={24} strokeWidth={LUCIDE_STROKE} aria-hidden />
    </Link>
  );
}

/** Sign-in / sign-up for guests (signed-in users get the Clerk UserButton in the top bar). */
export function GuestAuthButtons({ className, stacked }: { className?: string; stacked?: boolean }) {
  const tAuth = useTranslations("auth");
  return (
    <Show when="signed-out">
      <div className={cn("flex gap-2", stacked && "flex-col", className)}>
        <Button variant="soft" size="sm" asChild className={cn(stacked && "w-full")}>
          <Link href="/sign-in">
            <LoginIcon size={18} aria-hidden />
            {tAuth("login")}
          </Link>
        </Button>
        <Button size="sm" asChild className={cn(stacked && "w-full")}>
          <Link href="/sign-up">
            <UserAddIcon size={18} aria-hidden />
            {tAuth("signup")}
          </Link>
        </Button>
      </div>
    </Show>
  );
}
