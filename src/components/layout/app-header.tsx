"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Moon,
  Globe,
  LogIn,
  UserPlus,
  LogOut,
  Menu,
  LayoutDashboard,
  CalendarDays,
  Target,
  Bell,
  Settings,
  BookOpen,
  Scroll,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTransition } from "react";
import { switchLocaleAction } from "@/actions/locale";
import { logoutAction } from "@/actions/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/today", icon: CalendarDays, labelKey: "today" as const },
  { href: "/quran", icon: BookOpen, labelKey: "quran" as const },
  { href: "/hadith", icon: Scroll, labelKey: "hadith" as const },
  { href: "/plan", icon: Target, labelKey: "plan" as const },
  { href: "/reminders", icon: Bell, labelKey: "reminders" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function AppHeader() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav"); // Use 'nav' namespace for navigation labels
  const [isPending, startTransition] = useTransition();
  const { user, isGuest, loading } = useAuth();
  const pathname = usePathname(); // For active state in sidebar

  const handleLocaleSwitch = () => {
    startTransition(() => {
      switchLocaleAction();
    });
  };

  const handleLogout = () => {
    startTransition(() => {
      logoutAction();
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/60">
      <div className="flex h-15 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          {/* Mobile brand (visible on small screens) */}
          <Link
            href="/"
            className="flex md:hidden items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Moon className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary whitespace-nowrap">
              {t("appName")}
            </span>
          </Link>
          {/* Desktop App Name Link */}
          <Link
            href="/"
            className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Moon className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary whitespace-nowrap">
              {t("appName")}
            </span>
          </Link>
        </div>

        {/* Mobile Menu Trigger & Content */}
        <div className="flex items-center gap-2">
          {/* Added gap for spacing between language switcher and menu trigger */}
          {/* Language Switcher - Always visible */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLocaleSwitch}
            disabled={isPending}
            aria-label={t("switchLanguage")}
          >
            <Globe className="h-4 w-4" />
          </Button>
          {/* Mobile Menu Trigger (hidden on desktop) */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[80vw] sm:w-100">
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("mobileMenu")}</SheetTitle>
                </SheetHeader>
                <Link
                  href="/"
                  className="flex items-center gap-2 py-4 border-b hover:opacity-80 transition-opacity"
                >
                  <Moon className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary whitespace-nowrap">
                    {t("appName")}
                  </span>
                </Link>
                <nav className="flex flex-col gap-1 px-2 py-4">
                  {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                          isActive && "bg-muted text-primary",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {tNav(item.labelKey)}
                      </Link>
                    );
                  })}
                </nav>
                <div className="flex flex-col gap-2 p-2 border-t mt-auto">
                  {!loading && isGuest && (
                    <>
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start"
                      >
                        <Link href="/">
                          <LayoutDashboard className="h-4 w-4 mr-3" />{" "}
                          {t("exploreTheApp")}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start"
                      >
                        <Link href="/login">
                          <LogIn className="h-4 w-4 mr-3" /> {tAuth("login")}
                        </Link>
                      </Button>
                      <Button asChild className="w-full justify-start">
                        <Link href="/signup">
                          <UserPlus className="h-4 w-4 mr-3" />{" "}
                          {tAuth("signup")}
                        </Link>
                      </Button>
                    </>
                  )}
                  {!loading && user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      disabled={isPending}
                      className="w-full justify-start"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      {tAuth("logout")}
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          {/* Desktop Auth/Logout Links (Hidden on Mobile) */}
          {!loading && isGuest && (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden md:flex"
              >
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  {tAuth("login")}
                </Link>
              </Button>
              <Button size="sm" asChild className="hidden md:flex">
                <Link href="/signup">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  {tAuth("signup")}
                </Link>
              </Button>
            </>
          )}
          {!loading && user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isPending}
              className="hidden md:flex"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              {tAuth("logout")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
