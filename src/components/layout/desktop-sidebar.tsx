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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/today", icon: CalendarDays, labelKey: "today" as const },
  { href: "/plan", icon: Target, labelKey: "plan" as const },
  { href: "/reminders", icon: Bell, labelKey: "reminders" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const { isGuest, loading } = useAuth();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2 px-6 py-5 border-b hover:bg-accent/50 transition-colors"
      >
        <Moon className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold text-primary">
          {tCommon("appName")}
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Guest auth buttons */}
      {!loading && isGuest && (
        <div className="px-3 py-4 border-t space-y-2">
          <Button className="w-full" asChild>
            <Link href="/signup">
              <UserPlus className="h-4 w-4 mr-2" />
              {tAuth("signup")}
            </Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">
              <LogIn className="h-4 w-4 mr-2" />
              {tAuth("login")}
            </Link>
          </Button>
        </div>
      )}
    </aside>
  );
}
