import type { ReactNode } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { BrandMark } from "@/components/icons/brand-mark";
import { TextThemeButton } from "@/components/shared/accessibility-sidebar";

// Port of the old src/app/(auth)/layout.tsx wrapper (rendered by the pathless `_auth` layout route). A slim header
// links home and opens "লেখা ও থিম" (text size and theme); there are no floating buttons over the form.
export function AuthPage({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-4">
        <Link
          href="/"
          className="flex min-h-12 items-center gap-2.5 rounded-rp-full pr-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <BrandMark size={20} />
          </span>
          <span className="font-display text-[18px] leading-[28px] text-rp-ink">{t("appName")}</span>
        </Link>
        <TextThemeButton />
      </header>
      <main id="main-content" className="flex items-center justify-center px-4 pt-6 pb-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
