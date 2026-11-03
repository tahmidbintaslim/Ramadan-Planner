import type { ComponentType } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Card } from "@/components/ui/card";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import { DuaIcon, QuranIcon, LanternIcon, type IconProps } from "@/components/icons/islamic-icons";

const ICONS: Record<"duas" | "books" | "quiz", ComponentType<IconProps>> = {
  duas: DuaIcon,
  books: QuranIcon,
  quiz: LanternIcon,
};

// Shared body of the placeholder pages (/duas, /books, /quiz): nav title, landing blurb, coming-soon note.
export function ComingSoonPage({
  titleKey,
  descKey,
}: {
  titleKey: "duas" | "books" | "quiz";
  descKey: "featureDuasDesc" | "featureBooksDesc" | "featureQuizDesc";
}) {
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const t = useTranslations("comingSoon");
  const Icon = ICONS[titleKey];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="rp-h1 text-rp-ink">{tNav(titleKey)}</h1>
      <Card className="items-start px-5" data-testid="coming-soon">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
          <Icon size={24} />
        </span>
        <p className="rp-body text-rp-ink">{tLanding(descKey)}</p>
        <p className="rp-small rounded-rp-md bg-rp-gold-tint px-3 py-2 text-rp-ink">
          <span className="font-semibold">{t("label")}</span> {t(titleKey)}
        </p>
        <Link href="/today" className={buttonVariants({ variant: "soft" })}>
          {t("backToToday")}
        </Link>
      </Card>
    </div>
  );
}
