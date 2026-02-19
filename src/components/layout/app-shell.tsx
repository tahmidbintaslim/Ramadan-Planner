"use client";

import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();

  return (
    <div className="min-h-screen">
      <DesktopSidebar />
      <div className={collapsed ? "md:pl-20" : "md:pl-64"}>
        <AppHeader />
        <main className="pb-20 md:pb-6 px-4 py-6 md:px-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
