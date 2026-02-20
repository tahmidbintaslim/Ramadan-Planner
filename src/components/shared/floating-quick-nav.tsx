"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingQuickNavProps {
  showDashboard?: boolean;
}

export function FloatingQuickNav({
  showDashboard = true,
}: FloatingQuickNavProps) {
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const isAuthPage =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot") ||
    pathname.startsWith("/auth");

  if (!isAuthPage) return null;

  return (
    <div className="fixed left-1/2 bottom-5 z-50 flex flex-col gap-2 -translate-x-1/2">
      <Button asChild size="sm" className="shadow-lg rounded-full">
        <Link href="/" aria-label={tNav("home")}>
          <Home className="h-4 w-4 mr-2" />
          {tNav("home")}
        </Link>
      </Button>
      {showDashboard && (
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="shadow-lg rounded-full"
        >
          <Link href="/dashboard" aria-label={tNav("dashboard")}>
            <LayoutDashboard className="h-4 w-4 mr-2" />
            {tNav("dashboard")}
          </Link>
        </Button>
      )}
    </div>
  );
}
