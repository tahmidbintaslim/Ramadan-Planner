"use client";

import { useEffect } from "react";

import { DesktopSidebar, SIDEBAR_WIDTH_CLASS } from "@/components/layout/desktop-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useTranslations } from "@/i18n/use-intl";
import { prefetchAppData } from "@/lib/prefetch-app-data";
import { track } from "@/lib/track";
import { useRouter } from "@tanstack/react-router";
import { useGuestLocalReminders } from "@/components/reminders/use-guest-local-reminders";

/** Renders nothing: guest reminders as browser notifications while the app is open (own component, so rule
 *  changes do not re-render the shell). */
function GuestLocalReminders() {
  useGuestLocalReminders();
  return null;
}

/** Renders nothing: one first-party page_view per resolved navigation (src/lib/track.ts). */
function PageViews() {
  const router = useRouter();
  useEffect(() => {
    track("page_view");
    return router.subscribe("onResolved", ({ pathChanged }) => {
      if (pathChanged) track("page_view");
    });
  }, [router]);
  return null;
}

// HIG margins: 16 compact (<=430), 24 medium, 48 regular (>=835, beside the 264 sidebar); content max 1200.
// Below 835px the bottom padding clears the tab bar (56 + the safe-area inset) plus 24. Keep it in step with MobileNav.
const BOTTOM_NAV_CLEARANCE = "pb-[calc(5rem+env(safe-area-inset-bottom))] regular:pb-12";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  // App start: once the browser is idle, warm the shared data cache for the main tabs (stored place).
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => prefetchAppData());
    return () => cancel(id);
  }, []);
  // Focus order: skip link, sidebar (regular), header / toolbar, content, tab bar (compact, medium).
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
        <main
          id="main-content"
          tabIndex={-1}
          className={`mx-auto w-full max-w-[1296px] px-4 pt-2 outline-none medium:px-6 regular:px-12 regular:pt-8 ${BOTTOM_NAV_CLEARANCE}`}
        >
          {children}
        </main>
      </div>
      <MobileNav />
      <GuestLocalReminders />
      <PageViews />
    </div>
  );
}
