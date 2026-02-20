"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Target,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/today", icon: CalendarDays, labelKey: "today" as const },
  { href: "/quran", icon: BookOpen, labelKey: "quran" as const },
  { href: "/plan", icon: Target, labelKey: "plan" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function MobileNav() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <nav
      aria-label={tCommon("mobileMenu")}
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[4.5rem] items-center justify-around border-t border-border/70 bg-card/95 px-1 backdrop-blur-md pb-safe md:hidden"
    >
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={tNav(item.labelKey)}
            className={cn(
              "tap-target min-w-[64px] rounded-md px-2 py-1.5 flex flex-col items-center justify-center gap-1 transition-colors focus-visible:bg-accent/70",
              isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
            <span className="text-xs font-medium leading-none">
              {tNav(item.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
