"use client";

import { useState } from "react";
import { AccessibilityControls } from "@/components/shared/accessibility-sidebar";
import { Link } from "@/components/shared/link";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslations } from "@/i18n/use-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { Show } from "@clerk/tanstack-react-start";
import { CrescentIcon, GlobeIcon, MoreIcon, TextSizeIcon } from "@/components/icons/islamic-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive, type NavItem } from "./nav-items";
import { GuestAuthButtons, useLocaleSwitch } from "./shell-actions";

// Floating bottom nav (below 1024px): 16px from the edges (safe-area aware), five equal 64×60 items, the active
// one with an accent-tint pill. The fifth item opens the "More" sheet with every other destination plus the
// language switch and sign-in. AppShell pads <main> by BOTTOM_NAV_CLEARANCE so content never hides behind it.

const itemClass =
  "group mx-auto flex h-[60px] w-full max-w-16 flex-col items-center justify-center gap-1 rounded-rp-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const sheetRowClass =
  "flex min-h-12 items-center gap-3 rounded-rp-md px-3 text-left text-rp-ink transition-colors hover:bg-rp-accent-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function TabContent({ item, active, label }: { item: Pick<NavItem, "icon">; active: boolean; label: string }) {
  const Icon = item.icon;
  return (
    <>
      <span
        className={cn(
          "flex h-[30px] w-[52px] items-center justify-center rounded-full transition-colors",
          active ? "bg-rp-accent-tint" : "group-hover:bg-rp-accent-tint/60",
        )}
      >
        <Icon size={22} aria-hidden />
      </span>
      <span className="rp-caption leading-none whitespace-nowrap">{label}</span>
    </>
  );
}

function MoreSheetBody({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tA11y = useTranslations("accessibility");
  const pathname = usePathname();
  const { isGuest } = useAuth();
  const { switchLocale, isPending } = useLocaleSwitch();
  const items = SECONDARY_NAV.filter((i) => !i.signedInOnly || !isGuest);

  return (
    <div className="flex flex-col gap-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <nav aria-label={t("more")}>
        <ul className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-rp-md px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-rp-accent-tint text-rp-accent" : "text-rp-ink hover:bg-rp-accent-tint/60",
                  )}
                >
                  <Icon size={22} aria-hidden />
                  <span className="rp-small font-medium leading-[18px]">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex flex-col gap-2 border-t border-rp-rule pt-4">
        <Show when="signed-out">
          <Link href="/" onClick={onNavigate} className={sheetRowClass}>
            <CrescentIcon size={22} aria-hidden />
            <span className="rp-row">{tCommon("exploreTheApp")}</span>
          </Link>
        </Show>
        <button
          type="button"
          onClick={switchLocale}
          disabled={isPending}
          className={sheetRowClass}
        >
          <GlobeIcon size={22} aria-hidden />
          <span className="rp-row">{tCommon("switchLanguage")}</span>
        </button>
        <GuestAuthButtons stacked />
      </div>
      <section aria-labelledby="more-a11y" className="flex flex-col gap-3 border-t border-rp-rule pt-4">
        <h3 id="more-a11y" className="rp-row flex items-center gap-3 px-3 text-rp-ink">
          <TextSizeIcon size={22} aria-hidden />
          {tA11y("title")}
        </h3>
        <AccessibilityControls className="px-3" />
      </section>
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = SECONDARY_NAV.some((i) => isNavActive(pathname, i.href));

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-rp-xl bg-rp-surface p-1.5 shadow-rp-soft lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "text-rp-accent" : "text-rp-muted hover:text-rp-ink")}
              >
                <TabContent item={item} active={active} label={t(item.shortKey ?? item.labelKey)} />
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(itemClass, moreActive || moreOpen ? "text-rp-accent" : "text-rp-muted hover:text-rp-ink")}
              >
                <TabContent item={{ icon: MoreIcon }} active={moreActive || moreOpen} label={t("more")} />
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] overflow-y-auto rounded-t-rp-xl border-0 bg-rp-surface"
            >
              <SheetHeader className="px-4 pt-5 pb-0">
                <SheetTitle className="rp-h2 text-rp-ink">{t("more")}</SheetTitle>
                <SheetDescription className="sr-only">{t("moreDescription")}</SheetDescription>
              </SheetHeader>
              <MoreSheetBody onNavigate={() => setMoreOpen(false)} />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
