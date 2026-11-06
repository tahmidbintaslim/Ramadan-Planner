"use client";

import { useLocale, useTranslations } from "@/i18n/use-intl";
import { CrescentIcon, DatesIcon, LanternIcon, type IconProps } from "@/components/icons/islamic-icons";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { DUA_CATEGORIES, duasIn, type DuaCategory } from "@/lib/duas";
import type { ComponentType } from "react";
import { DuaCard } from "./dua-card";

const CATEGORY_ICONS: Record<DuaCategory, ComponentType<IconProps>> = {
  sehri: CrescentIcon,
  iftar: DatesIcon,
  lastTen: LanternIcon,
};

/**
 * /duas: the app's sourced Ramadan duas by moment (সেহরি ও নিয়ত, ইফতার, শেষ দশক). Category cards with counts jump
 * to their section; each dua reads Arabic, transliteration, meaning, then the reference line.
 */
export function DuasPage() {
  const t = useTranslations("duas");
  const locale = useLocale();
  const count = (n: number) => t("count", { count: locale === "en" ? n : formatLocalizedNumber(n, locale) });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="rp-h1 text-rp-ink">{t("title")}</h1>
        <p className="rp-small text-rp-muted">{t("intro")}</p>
      </div>

      <nav aria-label={t("categories")}>
        <ul className="grid grid-cols-3 gap-3">
          {DUA_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            return (
              <li key={cat}>
                <a
                  href={`#duas-${cat}`}
                  className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-rp-md bg-rp-surface px-2 py-3 text-center text-rp-ink shadow-rp-soft outline-none transition-colors hover:bg-rp-accent-tint/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <span className="flex size-10 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
                    <Icon size={22} />
                  </span>
                  <span className="rp-small font-semibold">{t(`cat.${cat}`)}</span>
                  <span className="rp-caption text-rp-muted">{count(duasIn(cat).length)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {DUA_CATEGORIES.map((cat) => (
        <section key={cat} id={`duas-${cat}`} aria-labelledby={`duas-${cat}-title`} className="flex scroll-mt-4 flex-col gap-3">
          <h2 id={`duas-${cat}-title`} className="rp-h2 text-rp-ink">
            {t(`cat.${cat}`)}
          </h2>
          {duasIn(cat).map((dua) => (
            <DuaCard key={dua.id} id={dua.id} headingLevel="h3" showWhen testId={`dua-${dua.id}`} />
          ))}
        </section>
      ))}
    </div>
  );
}
