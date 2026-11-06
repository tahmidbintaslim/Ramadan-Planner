import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import { ClockIcon } from "@/components/icons/islamic-icons";

/**
 * The calm page a feature that is switched off (src/config/features.ts) shows at its direct URL: the feature's name,
 * one line saying it is not ready, and a way back. Nothing on it suggests the feature works yet. The route is
 * noindex (the `_app` layout) and listed nowhere.
 */
export function ComingSoonPage({ titleKey }: { titleKey: "hadith" | "books" | "quiz" }) {
  const tNav = useTranslations("nav");
  const t = useTranslations("comingSoon");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="rp-h1 text-rp-ink">{tNav(titleKey)}</h1>
      <section
        data-testid="coming-soon"
        className="flex flex-col items-start gap-3 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft"
      >
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-rp-full bg-rp-gold-tint text-rp-gold-text">
          <ClockIcon size={24} />
        </span>
        <p className="rp-h2">{t("label")}</p>
        <p className="rp-body text-rp-muted">{t("body")}</p>
        <Link href="/today" className={buttonVariants({ variant: "soft" })}>
          {t("backToToday")}
        </Link>
      </section>
    </div>
  );
}
