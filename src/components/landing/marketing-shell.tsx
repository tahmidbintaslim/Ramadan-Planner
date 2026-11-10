import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MenuIcon } from "@/components/icons/islamic-icons";
import { BrandLockup, SiteHeader } from "@/components/layout/site-header";
import { LanguageSegmented, roundButtonClass } from "@/components/layout/shell-actions";
import { useAuth } from "@/components/providers/auth-provider";
import { usePathname } from "@/hooks/use-pathname";
import { SUPPORT_CONFIG } from "@/config/support";
import { needsOnboarding, subscribeStoredLocation } from "@/lib/user-location";
import { cn } from "@/lib/utils";

/**
 * Where "Get started" leads: onboarding for a first-time guest, straight to Today otherwise. The server (and
 * the hydrating render) link to onboarding; the device's choice is read after mount and followed on every save.
 */
export function useStartHref(): string {
  const { user } = useAuth();
  const onboard = useSyncExternalStore(
    subscribeStoredLocation,
    () => needsOnboarding(user !== null),
    () => true,
  );
  return onboard ? "/welcome" : "/today";
}

const noSubscribe = () => () => {};

/**
 * The copyright year: the server's year (from the route loader, so the hydrating render matches the HTML), then
 * the device's year after mount.
 */
export function useFooterYear(serverYear: number): number {
  return useSyncExternalStore(noSubscribe, () => new Date().getFullYear(), () => serverYear);
}

/** The site's pages, in the header (regular), the menu sheet (compact, medium) and the footer. */
const SITE_NAV = [
  ["/features", "navFeatures"],
  ["/pricing", "navPricing"],
  ["/contact", "navContact"],
] as const;

export const marketingSection = "mx-auto w-full max-w-[1296px] px-4 py-16 medium:px-6 regular:px-12 regular:py-24";

/**
 * The frame of every public site page (home, features, pricing, contact): skip link, the header with the site
 * nav, sign in and the start button (a menu sheet below the regular width), the page, and the footer.
 */
export function MarketingShell({ serverYear, children }: { serverYear: number; children: ReactNode }) {
  const t = useTranslations("landing");
  const tM = useTranslations("marketing");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const startHref = useStartHref();
  const year = useFooterYear(serverYear);
  const [menuOpen, setMenuOpen] = useState(false);
  const repo = SUPPORT_CONFIG.repoUrl;
  const navLink = "rp-callout inline-flex min-h-11 items-center rounded-rp-input px-3 hover:text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus";
  const footLink = "rp-body inline-flex min-h-11 items-center text-rp-ink hover:text-rp-accent";

  return (
    <div className="flex min-h-dvh flex-col bg-rp-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-rp-sm focus:bg-rp-surface focus:px-3 focus:py-2 focus:shadow"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader
        actions={
          <>
            {user ? null : (
              <Link href="/sign-in" className={cn(navLink, "hidden text-rp-ink regular:inline-flex")}>
                {tAuth("login")}
              </Link>
            )}
            <Link href={startHref} className={cn(buttonVariants(), "hidden medium:inline-flex")}>
              {user ? tM("openApp") : t("getStarted")}
            </Link>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger aria-label={tM("menu")} className={cn(roundButtonClass, "regular:hidden")}>
                <MenuIcon size={24} />
              </SheetTrigger>
              <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-2xl gap-0 overflow-y-auto rounded-t-rp-xl border-0 bg-rp-page text-rp-ink">
                <SheetHeader>
                  <SheetTitle className="rp-headline text-rp-ink">{tM("menu")}</SheetTitle>
                  <SheetDescription className="sr-only">{tM("siteNav")}</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                  <nav aria-label={tM("siteNav")} className="overflow-hidden rounded-rp-md bg-rp-surface">
                    {[...SITE_NAV, ...(user ? [] : ([["/sign-in", "login"]] as const))].map(([href, key]) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={pathname === href ? "page" : undefined}
                        className="rp-row flex min-h-[52px] items-center border-b border-rp-rule px-4 text-rp-ink last:border-b-0 aria-[current=page]:font-semibold aria-[current=page]:text-rp-accent"
                      >
                        {key === "login" ? tAuth("login") : tM(key)}
                      </Link>
                    ))}
                  </nav>
                  <LanguageSegmented className="w-full medium:hidden" />
                  <Link href={startHref} onClick={() => setMenuOpen(false)} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                    {user ? tM("openApp") : t("getStarted")}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </>
        }
      >
        <nav aria-label={tM("siteNav")} className="me-2 hidden regular:flex">
          {SITE_NAV.map(([href, key]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(navLink, "text-rp-ink aria-[current=page]:font-semibold aria-[current=page]:text-rp-accent")}
            >
              {tM(key)}
            </Link>
          ))}
        </nav>
      </SiteHeader>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      <footer className="border-t border-rp-rule bg-rp-surface">
        <div className="mx-auto grid max-w-[1296px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-12 medium:px-6 regular:grid-cols-[1fr_auto_auto_auto] regular:gap-20 regular:px-12">
          <div className="flex flex-col gap-2">
            <BrandLockup />
            <p className="rp-small text-rp-muted">{t("footerTagline")}</p>
          </div>
          <nav aria-label={t("footerNav")} className="grid grid-cols-2 gap-8 medium:grid-cols-3 regular:contents">
            <div className="flex flex-col">
              <p className="rp-small mb-1 text-rp-muted">{t("footerApp")}</p>
              {(
                [
                  ["/today", "footerToday"],
                  ["/timetable", "footerTimetable"],
                  ["/plan", "footerAmal"],
                  ["/quran", "footerQuran"],
                  ["/duas", "footerDuas"],
                ] as const
              ).map(([href, key]) => (
                <Link key={href} href={href} className={footLink}>
                  {t(key)}
                </Link>
              ))}
            </div>
            <div className="flex flex-col">
              <p className="rp-small mb-1 text-rp-muted">{tCommon("appName")}</p>
              {SITE_NAV.map(([href, key]) => (
                <Link key={href} href={href} className={footLink}>
                  {tM(key)}
                </Link>
              ))}
              {user ? null : (
                <>
                  <Link href="/sign-in" className={footLink}>
                    {tAuth("login")}
                  </Link>
                  <Link href="/sign-up" className={footLink}>
                    {tAuth("signup")}
                  </Link>
                </>
              )}
            </div>
            <div className="flex flex-col">
              <p className="rp-small mb-1 text-rp-muted">{t("footerProject")}</p>
              <Link href="/support" className={footLink}>
                {t("footerSupport")}
              </Link>
              <a href={repo} rel="noopener noreferrer" target="_blank" className={footLink}>
                {t("footerSource")}
              </a>
              <a href={`${repo}/issues`} rel="noopener noreferrer" target="_blank" className={footLink}>
                {t("footerReport")}
              </a>
            </div>
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1296px] flex-col gap-2 border-t border-rp-rule px-4 py-6 medium:px-6 regular:flex-row regular:justify-between regular:px-12">
          <p className="rp-small text-rp-muted">{t("footerTimesSource")}</p>
          <p className="rp-small text-rp-muted">
            {t("footerPromise")} · &copy; {formatLocalizedNumber(year, locale)} {tCommon("appName")}
          </p>
        </div>
      </footer>
    </div>
  );
}
