"use client";

import { useTransition } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { usePathname } from "@/hooks/use-pathname";
import { useRouter } from "@tanstack/react-router";
import { CrescentIcon } from "@/components/icons/islamic-icons";
import { AccessibilityControls, AccessibilityDialog } from "@/components/shared/accessibility-sidebar";
import {
  Accessibility,
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
import { Show, UserButton } from "@clerk/tanstack-react-start";
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

/** Brand header for pages outside the app shell (the landing page), in the v2 style. */
export function SiteHeader() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const tA11y = useTranslations("accessibility");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleSwitch = () => {
    startTransition(async () => {
      await switchLocaleAction();
      // Re-run the root loader so the new locale's messages render (Next refreshed automatically).
      await router.invalidate();
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-rp-rule bg-rp-page/95 backdrop-blur supports-backdrop-filter:bg-rp-page/80">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex min-h-12 items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-rp-sm bg-rp-live text-rp-on-live">
              <CrescentIcon size={20} />
            </span>
            <span className="font-display text-[20px] leading-[30px] text-rp-ink whitespace-nowrap">
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

          {/* md+: the accessibility controls in a dialog (phones reach them from the menu sheet). */}
          <div className="hidden md:block">
            <AccessibilityDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={tA11y("title")}>
                  <Accessibility className="h-5 w-5" />
                </Button>
              }
            />
          </div>

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("mobileMenu")}>
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
                  <CrescentIcon size={20} className="text-rp-accent" />
                  <span className="font-display text-[20px] leading-[30px] text-rp-ink whitespace-nowrap">
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
                <section aria-labelledby="site-sheet-a11y" className="space-y-3 border-t border-rp-rule px-3 py-4">
                  <h2 id="site-sheet-a11y" className="rp-small font-semibold text-rp-ink">
                    {tA11y("title")}
                  </h2>
                  <AccessibilityControls />
                </section>
                <div className="flex flex-col gap-2 p-2 border-t mt-auto">
                  <Show when="signed-out">
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
                  </Show>
                  <Show when="signed-in">
                    <div className="px-2 py-1">
                      <UserButton />
                    </div>
                  </Show>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Show when="signed-out">
              <Button variant="ghost" size="sm" asChild className="h-12">
                <Link href="/sign-in">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  {tAuth("login")}
                </Link>
              </Button>
              <Button size="sm" asChild className="h-12">
                <Link href="/sign-up">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  {tAuth("signup")}
                </Link>
              </Button>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}
