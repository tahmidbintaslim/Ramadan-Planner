import type { ReactNode } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { duaById, type DuaId } from "@/lib/duas";
import { cn } from "@/lib/utils";

/**
 * One sourced dua, in the reading order of a dua detail: Arabic (Noto Naskh Arabic, right to left), transliteration,
 * meaning, then the reference line. Used by the Home phase card, the Laylatul Qadr card on /plan and /duas.
 */
export function DuaCard({
  id,
  icon,
  headingLevel = "h2",
  className,
  testId,
  showWhen = false,
}: {
  id: DuaId;
  /** Shown before the title (the Home phase card). */
  icon?: ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string;
  testId?: string;
  /** Show when the dua is read ("ইফতারের সময় পড়ুন") under the title. */
  showWhen?: boolean;
}) {
  const t = useTranslations("duas");
  const dua = duaById(id);
  const Heading = headingLevel;
  const titleId = `dua-${id}-title`;
  return (
    <section
      aria-labelledby={titleId}
      data-testid={testId}
      data-dua={id}
      className={cn("flex flex-col gap-2 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft", className)}
    >
      <Heading id={titleId} className="rp-row flex items-center gap-2 font-semibold">
        {icon}
        {t(`items.${id}.title`)}
      </Heading>
      {showWhen ? <p className="rp-caption -mt-1 text-rp-muted">{t(`items.${id}.when`)}</p> : null}
      <p lang="ar" dir="rtl" className="font-arabic text-[24px] leading-[48px] text-rp-ink">
        {dua.arabic}
      </p>
      <p className="font-reading text-[17px] leading-[30px] font-medium">{t(`items.${id}.translit`)}</p>
      <p className="rp-reading-small text-rp-muted">{t(`items.${id}.meaning`)}</p>
      <p className="rp-caption text-rp-gold-text">{t(`items.${id}.reference`)}</p>
    </section>
  );
}
