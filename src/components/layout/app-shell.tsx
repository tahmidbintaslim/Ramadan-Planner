"use client";

import { DesktopSidebar, SIDEBAR_WIDTH_CLASS } from "@/components/layout/desktop-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useTranslations } from "@/i18n/use-intl";

// Bottom padding below 1024px clears the floating bottom nav: 16px gap + 72px bar (60px items + 2×6px padding)
// + 24px breathing room, plus the safe-area inset. Keep it in step with MobileNav.
const BOTTOM_NAV_CLEARANCE = "pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-10";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  // Focus order: skip link, side nav (desktop), top bar, content, bottom nav (mobile).
  return (
    <div className="min-h-screen bg-rp-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-rp-sm focus:bg-rp-surface focus:px-4 focus:py-3 focus:text-rp-ink focus:shadow-rp-soft"
      >
        {t("skipToContent")}
      </a>
      <DesktopSidebar />
      <div className={SIDEBAR_WIDTH_CLASS}>
        <AppHeader />
        <main id="main-content" tabIndex={-1} className={`px-4 pt-2 outline-none md:px-6 md:pt-4 lg:px-8 ${BOTTOM_NAV_CLEARANCE}`}>
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
