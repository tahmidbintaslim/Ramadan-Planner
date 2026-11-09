"use client";

import { Link } from "@/components/shared/link";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslations } from "@/i18n/use-intl";
import { BrandMark } from "@/components/icons/brand-mark";
import { cn } from "@/lib/utils";
import { LUCIDE_STROKE, PRIMARY_NAV, SECONDARY_NAV, SETTINGS_HREF, isNavActive, type NavItem } from "./nav-items";
import { useIsAdmin } from "@/hooks/use-is-admin";

// Sidebar (regular, >=835px; v4): 264 wide on bg/bar with a hairline rule. Brand row (40 teal tile + crescent, app
// name), the four primary destinations, a "More tools" group, Settings at the foot. Rows 44 tall, inset 16, radius
// 12; icon 24 + Body 17; the selected row on fill/tonal in text/selected. AppShell offsets the content by
// SIDEBAR_WIDTH_CLASS. Text & Theme and the language live in the toolbar.

export const SIDEBAR_WIDTH_CLASS = "regular:pl-[264px]";

function NavLink({ item, pathname, label }: { item: NavItem; pathname: string; label: string }) {
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "rp-row flex min-h-11 items-center gap-3 rounded-rp-input px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
          active ? "bg-rp-accent-tint font-semibold text-rp-selected" : "text-rp-ink hover:bg-rp-accent-tint/60",
        )}
      >
        <Icon size={24} strokeWidth={LUCIDE_STROKE} className={cn("shrink-0", active ? "text-rp-selected" : "text-rp-icon")} />
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    </li>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const isAdmin = useIsAdmin();
  const settings = SECONDARY_NAV.find((i) => i.href === SETTINGS_HREF);
  const tools = SECONDARY_NAV.filter((i) => i.href !== SETTINGS_HREF && (!i.adminOnly || isAdmin));

  return (
    <aside className="hidden regular:fixed regular:inset-y-0 regular:left-0 regular:z-30 regular:flex regular:w-[264px] regular:flex-col border-r border-rp-rule bg-rp-bar">
      <Link
        href="/"
        className="mx-4 mt-4 mb-4 flex min-h-14 items-center gap-3 rounded-rp-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-rp-input bg-rp-live text-rp-on-live">
          <BrandMark size={24} />
        </span>
        <span className="rp-headline min-w-0 text-rp-ink">{tCommon("appName")}</span>
      </Link>

      <nav aria-label={t("mainNav")} className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} label={t(item.shortKey ?? item.labelKey)} />
          ))}
        </ul>
        <h2 className="rp-caption mt-6 mb-2 px-3 text-rp-muted">{t("moreTools")}</h2>
        <ul className="flex flex-col gap-1">
          {tools.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} label={t(item.shortKey ?? item.labelKey)} />
          ))}
        </ul>
        {settings ? (
          <ul className="mt-auto flex flex-col pt-4">
            <NavLink item={settings} pathname={pathname} label={t(settings.labelKey)} />
          </ul>
        ) : null}
      </nav>
    </aside>
  );
}
