import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppHeader } from "@/components/layout/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <DesktopSidebar />
      <div className="md:pl-64">
        <AppHeader />
        <main className="pb-20 md:pb-6 px-4 py-6 md:px-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
