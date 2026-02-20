"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Moon,
  Globe,
  LogIn,
  UserPlus,
  Menu,
  LayoutDashboard,
  CalendarDays,
  Target,
  Bell,
  Settings,
  BookOpen,
  Library,
  HandHeart,
  Brain,
  Calculator,
  Hand,
  Scroll,
} from "lucide-react";
import {
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { switchLocaleAction } from "@/actions/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/today", icon: CalendarDays, labelKey: "today" as const },
  { href: "/quran", icon: BookOpen, labelKey: "quran" as const },
  { href: "/books", icon: Library, labelKey: "books" as const },
  { href: "/duas", icon: HandHeart, labelKey: "duas" as const },
  { href: "/hadith", icon: Scroll, labelKey: "hadith" as const },
  { href: "/quiz", icon: Brain, labelKey: "quiz" as const },
  { href: "/tasbih", icon: Hand, labelKey: "tasbih" as const },
  { href: "/zakat", icon: Calculator, labelKey: "zakat" as const },
  { href: "/plan", icon: Target, labelKey: "plan" as const },
  { href: "/reminders", icon: Bell, labelKey: "reminders" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function AppHeader() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  const handleLocaleSwitch = () => {
    startTransition(() => {
      switchLocaleAction();
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/60">
      <div className="flex h-15 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Moon className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary whitespace-nowrap">
              {t("appName")}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLocaleSwitch}
            disabled={isPending}
            aria-label={t("switchLanguage")}
          >
            <Globe className="h-4 w-4" />
          </Button>

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
                  <SignedOut>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link href="/">
                        <LayoutDashboard className="h-4 w-4 mr-3" />
                        {t("exploreTheApp")}
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link href="/sign-in">
                        <LogIn className="h-4 w-4 mr-3" />
                        {tAuth("login")}
                      </Link>
                    </Button>
                    <Button asChild className="w-full justify-start">
                      <Link href="/sign-up">
                        <UserPlus className="h-4 w-4 mr-3" />
                        {tAuth("signup")}
                      </Link>
                    </Button>
                  </SignedOut>
                  <SignedIn>
                    <div className="px-2 py-1">
                      <UserButton />
                    </div>
                  </SignedIn>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <SignedOut>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  {tAuth("login")}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  {tAuth("signup")}
                </Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
