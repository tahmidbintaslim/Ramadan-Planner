import { SearchX } from "lucide-react";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { useTranslations } from "@/i18n/use-intl";

// Root notFoundComponent (Figma page 12, D10): inside the app shell so the tab bar and sidebar stay, with one way back.
export function NotFound() {
  const t = useTranslations("common");

  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
          <SearchX size={32} strokeWidth={LUCIDE_STROKE} />
        </span>
        <h1 className="rp-h2 text-rp-ink">{t("pageNotFoundTitle")}</h1>
        <p className="rp-body max-w-sm text-rp-muted">{t("pageNotFoundDesc")}</p>
        <Button asChild className="mt-2 w-full max-w-xs">
          <Link href="/today">{t("goToToday")}</Link>
        </Button>
      </div>
    </AppShell>
  );
}
