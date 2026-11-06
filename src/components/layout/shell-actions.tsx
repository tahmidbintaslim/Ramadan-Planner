"use client";

import { useTransition } from "react";
import { useRouter } from "@tanstack/react-router";
import { GlobeIcon, LoginIcon, UserAddIcon } from "@/components/icons/islamic-icons";
import { Show } from "@clerk/tanstack-react-start";
import { useTranslations } from "@/i18n/use-intl";
import { switchLocaleAction } from "@/actions/locale";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Toggles bn/en and re-runs the root loader so the new locale's messages render. */
export function useLocaleSwitch() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const switchLocale = () => {
    startTransition(async () => {
      await switchLocaleAction();
      await router.invalidate();
    });
  };
  return { switchLocale, isPending };
}

/** 48px round white button with the soft shadow (top bar actions). */
export const roundButtonClass =
  "inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-rp-surface text-rp-ink shadow-rp-soft transition-colors hover:text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-rp-page disabled:opacity-50";

export function LanguageButton({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { switchLocale, isPending } = useLocaleSwitch();
  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={t("switchLanguage")}
      className={cn(roundButtonClass, className)}
    >
      <GlobeIcon size={20} aria-hidden />
    </button>
  );
}

/** Sign-in / sign-up for guests (signed-in users get the Clerk UserButton in the top bar). */
export function GuestAuthButtons({ className, stacked }: { className?: string; stacked?: boolean }) {
  const tAuth = useTranslations("auth");
  return (
    <Show when="signed-out">
      <div className={cn("flex gap-2", stacked && "flex-col", className)}>
        <Button variant="outline" size={stacked ? "default" : "sm"} asChild className={cn(stacked && "w-full")}>
          <Link href="/sign-in">
            <LoginIcon size={16} aria-hidden />
            {tAuth("login")}
          </Link>
        </Button>
        <Button size={stacked ? "default" : "sm"} asChild className={cn(stacked && "w-full")}>
          <Link href="/sign-up">
            <UserAddIcon size={16} aria-hidden />
            {tAuth("signup")}
          </Link>
        </Button>
      </div>
    </Show>
  );
}
