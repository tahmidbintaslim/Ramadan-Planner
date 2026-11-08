"use client";

import type { ReactNode } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { BrandMark } from "@/components/icons/brand-mark";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";
import { cn } from "@/lib/utils";
import { LanguageSegmented } from "./shell-actions";

/** The brand tile + name (v4): 40 teal tile, radius 12, the logo mark (white crescent, gold star); Headline name. */
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
        <BrandMark size={24} />
      </span>
      <span className="rp-headline whitespace-nowrap text-rp-ink">{t("appName")}</span>
    </Link>
  );
}

/**
 * The web homepage header (medium and regular, v4): brand lockup, the language segmented control (বাংলা | English)
 * and Text & Theme, in the 1200 content column with a hairline rule. `children` (page anchors) sit before the
 * language control; compact keeps only the brand and Text & Theme.
 */
export function SiteHeader({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-rp-rule bg-rp-page", className)}>
      <div className="mx-auto flex h-16 max-w-[1296px] items-center justify-between gap-4 px-6 regular:px-12">
        <BrandLockup />
        <div className="flex items-center gap-2">
          {children}
          <LanguageSegmented className="hidden medium:inline-grid" />
          <TextThemeButton />
        </div>
      </div>
    </header>
  );
}
