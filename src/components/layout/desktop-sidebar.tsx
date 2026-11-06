"use client";

import { Link } from "@/components/shared/link";
import { AccessibilityDialog } from "@/components/shared/accessibility-sidebar";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslations } from "@/i18n/use-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { CrescentIcon, TextSizeIcon } from "@/components/icons/islamic-icons";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive, type NavItem } from "./nav-items";

// Desktop side nav (≥1024px): 232px on the surface colour, brand row (36px teal circle + crescent, app name), then
// the primary destinations and the rest. Items: icon 22 + label 16/22 600, px 14 py 10, radius 14; active item
// uses the accent tint; links are at least 48px tall. Guest sign-in lives in the top bar only. AppShell offsets
// the content by SIDEBAR_WIDTH_CLASS.

export const SIDEBAR_WIDTH_CLASS = "lg:pl-[232px]";

function NavLink({ item, pathname, label }: { item: NavItem; pathname: string; label: string }) {
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 py-2.5 rp-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-rp-accent-tint text-rp-accent" : "text-rp-muted hover:bg-rp-accent-tint/60 hover:text-rp-ink",
        )}
      >
        <Icon size={22} aria-hidden className="shrink-0" />
        <span className="min-w-0 leading-[20px]">{label}</span>
      </Link>
    </li>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tA11y = useTranslations("accessibility");
  const { isGuest } = useAuth();
  const secondary = SECONDARY_NAV.filter((i) => !i.signedInOnly || !isGuest);

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[232px] lg:flex-col bg-rp-surface">
      <Link
        href="/"
        className="mx-3 mt-5 mb-4 flex items-center gap-3 rounded-[14px] px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CrescentIcon size={20} aria-hidden />
        </span>
        <span className="rp-h2 truncate text-rp-ink">{tCommon("appName")}</span>
      </Link>

      <nav aria-label={t("mainNav")} className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} label={t(item.shortKey ?? item.labelKey)} />
          ))}
        </ul>
        <ul className="mt-3 flex flex-col gap-1 border-t border-rp-rule pt-3">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-rp-rule px-3 py-4">
        <AccessibilityDialog
          trigger={
            <button
              type="button"
              className="flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 rp-button text-rp-muted transition-colors hover:bg-rp-accent-tint/60 hover:text-rp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TextSizeIcon size={22} className="shrink-0" aria-hidden />
              <span className="truncate">{tA11y("title")}</span>
            </button>
          }
        />
      </div>
    </aside>
  );
}
