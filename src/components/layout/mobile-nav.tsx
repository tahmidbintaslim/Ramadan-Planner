"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AccessibilityControls } from "@/components/shared/accessibility-sidebar";
import { Link } from "@/components/shared/link";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslations } from "@/i18n/use-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { Show } from "@clerk/tanstack-react-start";
import { CrescentIcon } from "@/components/icons/islamic-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LUCIDE_STROKE, MORE_ICON, PRIMARY_NAV, SECONDARY_NAV, SETTINGS_HREF, isNavActive, type NavItem } from "./nav-items";
import { GuestAuthButtons, LanguageSegmented } from "./shell-actions";

// Tab bar (compact and medium, below 835px; v4): full width on bg/bar with a hairline rule, 56 tall plus the safe
// area, five equal labelled items (icon 24 + Footnote 13, 44 minimum). The selected item reads text/selected. The
// fifth item opens the "More" sheet: every other destination as an inset-grouped list, the language and Text &
// Theme. AppShell pads <main> by BOTTOM_NAV_CLEARANCE so content never hides behind it.

const itemClass =
  "rp-pressable flex h-14 w-full min-w-11 flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus";

function TabContent({ icon: Icon, label }: { icon: NavItem["icon"]; label: string }) {
  return (
    <>
      <Icon size={24} strokeWidth={LUCIDE_STROKE} />
      <span className="rp-caption leading-none whitespace-nowrap">{label}</span>
    </>
  );
}

// The app's own pages; everything else in the More sheet is a tool.
const APP_HREFS = new Set(["/support", SETTINGS_HREF, "/admin/announcements"]);

function MoreSheetBody({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tA11y = useTranslations("accessibility");
  const pathname = usePathname();
  const { isGuest } = useAuth();
  const items = SECONDARY_NAV.filter((i) => !i.signedInOnly || !isGuest);

  return (
    <div className="flex flex-col gap-6 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {/* Grouped like Figma page 12, D6: tools, then the app's own pages. */}
      <nav aria-label={t("more")} className="flex flex-col gap-6">
        {(
          [
            ["tools", t("moreTools"), items.filter((i) => !APP_HREFS.has(i.href))],
            ["app", tCommon("app"), items.filter((i) => APP_HREFS.has(i.href))],
          ] as const
        ).map(([key, caption, group]) => (
          <section key={key} aria-labelledby={`more-${key}`} className="flex flex-col gap-2">
            <h3 id={`more-${key}`} className="rp-caption px-4 text-rp-muted">
              {caption}
            </h3>
            <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
              {group.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href} className="relative after:absolute after:right-0 after:bottom-0 after:left-14 after:h-px after:bg-rp-rule last:after:hidden">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rp-row flex min-h-[52px] items-center gap-4 px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus",
                        active ? "bg-rp-accent-tint font-semibold text-rp-selected" : "text-rp-ink hover:bg-rp-accent-tint/60",
                      )}
                    >
                      <Icon size={24} strokeWidth={LUCIDE_STROKE} className="shrink-0 text-rp-icon" />
                      <span className="min-w-0 flex-1">{t(item.href === "/reminders" ? "remindersShort" : item.labelKey)}</span>
                      <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      <section aria-labelledby="more-language" className="flex flex-col gap-2">
        <h3 id="more-language" className="rp-caption px-4 text-rp-muted">
          {tCommon("language")}
        </h3>
        <LanguageSegmented className="w-full" />
      </section>
      <div className="flex flex-col gap-2">
        <Show when="signed-out">
          <Link
            href="/"
            onClick={onNavigate}
            className="rp-row flex min-h-11 items-center gap-3 rounded-rp-input px-4 text-rp-accent hover:bg-rp-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
          >
            <CrescentIcon size={24} aria-hidden />
            {tCommon("exploreTheApp")}
          </Link>
        </Show>
        <GuestAuthButtons stacked />
      </div>
      <section aria-labelledby="more-a11y" className="flex flex-col gap-3 rounded-rp-md bg-rp-surface p-4">
        <h3 id="more-a11y" className="rp-headline text-rp-ink">
          {tA11y("title")}
        </h3>
        <AccessibilityControls />
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rp-rule bg-rp-bar pb-[env(safe-area-inset-bottom)] regular:hidden"
    >
      <ul className="mx-auto grid max-w-[834px] grid-cols-5 px-2">
        {PRIMARY_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "text-rp-selected" : "text-rp-muted hover:text-rp-ink")}
              >
                <TabContent icon={item.icon} label={t(item.shortKey ?? item.labelKey)} />
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(itemClass, moreActive || moreOpen ? "text-rp-selected" : "text-rp-muted hover:text-rp-ink")}
              >
                <TabContent icon={MORE_ICON} label={t("more")} />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-rp-xl border-0 bg-rp-page">
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
