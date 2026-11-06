"use client";

import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { CrescentIcon } from "@/components/icons/islamic-icons";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";
import { cn } from "@/lib/utils";
import { LanguageSegmented } from "./shell-actions";

/** The brand tile + name (v4): 40 teal tile, radius 12, crescent; Headline name. */
export function BrandLockup({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Link
      href="/"
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-rp-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
        className,
      )}
    >
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-rp-input bg-rp-live text-rp-on-live">
        <CrescentIcon size={24} />
      </span>
      <span className="rp-headline whitespace-nowrap text-rp-ink">{t("appName")}</span>
    </Link>
  );
}

/**
 * The web homepage header (medium and regular, v4): brand lockup, the language segmented control (বাংলা | English)
 * and Text & Theme, in the 1200 content column with a hairline rule.
 */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-rp-rule bg-rp-page", className)}>
      <div className="mx-auto flex h-16 max-w-[1296px] items-center justify-between gap-4 px-6 regular:px-12">
        <BrandLockup />
        <div className="flex items-center gap-2">
          <LanguageSegmented />
          <TextThemeButton />
        </div>
      </div>
    </header>
  );
}
