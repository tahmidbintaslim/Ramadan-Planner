"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  Target,
  Bell,
  Settings,
  Moon,
  LogIn,
  UserPlus,
  BookOpen,
  Scroll,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/today", icon: CalendarDays, labelKey: "today" as const },
  { href: "/quran", icon: BookOpen, labelKey: "quran" as const },
  { href: "/hadith", icon: Scroll, labelKey: "hadith" as const },
  { href: "/plan", icon: Target, labelKey: "plan" as const },
  { href: "/reminders", icon: Bell, labelKey: "reminders" as const },
  {
    href: "/admin/announcements",
    icon: ShieldCheck,
    labelKey: "admin" as const,
  },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const { isGuest, loading } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r bg-card transition-all duration-150 overflow-hidden",
        collapsed ? "md:w-20" : "md:w-64",
      )}
    >
      {/* Logo + collapse button */}
      <div
        className={cn(
          "flex items-center justify-between px-2 py-3 border-b transition-colors",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 hover:bg-accent/50 transition-opacity",
            collapsed ? "px-2" : "px-6",
          )}
        >
          <Moon className="h-6 w-6 text-primary" />
          {!collapsed && (
            <span className="text-lg font-semibold text-primary whitespace-nowrap">
              {tCommon("appName")}
            </span>
          )}
        </Link>

        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            className="p-1"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5",
                isActive
                  ? collapsed
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Guest auth buttons */}
      {!loading && isGuest && (
        <div
          className={cn(
            "px-3 py-4 border-t space-y-2",
            collapsed ? "flex flex-col items-center" : "",
          )}
        >
          <Button
            className={cn("w-full", collapsed ? "w-auto" : "w-full")}
            asChild
          >
            <Link
              href="/signup"
              className={cn(
                "flex items-center",
                collapsed ? "justify-center" : "justify-start",
              )}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {!collapsed && tAuth("signup")}
            </Link>
          </Button>
          <Button
            variant="outline"
            className={cn(collapsed ? "w-auto" : "w-full")}
            asChild
          >
            <Link
              href="/login"
              className={cn(
                "flex items-center",
                collapsed ? "justify-center" : "justify-start",
              )}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {!collapsed && tAuth("login")}
            </Link>
          </Button>
        </div>
      )}
    </aside>
  );
}
