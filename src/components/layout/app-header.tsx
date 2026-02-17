"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Moon, Globe, LogIn, UserPlus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { switchLocaleAction } from "@/actions/locale";
import { logoutAction } from "@/actions/auth";
import { useAuth } from "@/components/providers/auth-provider";

export function AppHeader() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const [isPending, startTransition] = useTransition();
  const { user, isGuest, loading } = useAuth();

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
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 md:hidden hover:opacity-80 transition-opacity"
        >
          <Moon className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">{t("appName")}</span>
        </Link>

        <div className="hidden md:block" />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLocaleSwitch}
            disabled={isPending}
            aria-label="Switch language"
          >
            <Globe className="h-4 w-4" />
          </Button>

          {!loading && isGuest && (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  {tAuth("login")}
                </Link>
              </Button>
              <Button size="sm" asChild>
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
