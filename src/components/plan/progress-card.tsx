import { useLocale, useTranslations } from "@/i18n/use-intl";
import { GirihPattern } from "@/components/design/girih-pattern";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { cn } from "@/lib/utils";
import { PlanIcon } from "@/components/icons/islamic-icons";
import { progressCopy } from "./plan-logic";

const SIZE = 84;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Teal progress card: an 84px ring with "done/total" and an encouraging line plus Quran progress. */
export function ProgressCard({
  done,
  total,
  quranPara,
  streak,
  className,
}: {
  done: number;
  total: number;
  /** Para from the Quran tracker (1-30), or null when unknown. */
  quranPara: number | null;
  /** Consecutive days with a Quran entry. */
  streak: number;
  className?: string;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const n = (v: number) => formatLocalizedNumber(v, locale);
  const fraction = total > 0 ? Math.min(1, done / total) : 0;
  const quranParts = [
    quranPara !== null ? t("quranProgress", { para: n(quranPara) }) : null,
    streak > 0 ? t("quranStreak", { days: n(streak) }) : null,
  ].filter(Boolean);

  return (
    <section
      aria-label={t("progressLabel")}
      data-testid="plan-progress"
      className={cn("relative isolate flex items-center gap-6 overflow-hidden rounded-[24px] p-6 text-white", className)}
      style={{ backgroundImage: "linear-gradient(90deg, var(--rp-teal-800), var(--rp-teal-600))" }}
    >
      <GirihPattern opacity={0.07} className="-z-10 text-white" />
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg aria-hidden="true" focusable="false" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="white" strokeOpacity={0.2} strokeWidth={STROKE} />
          <circle
            data-testid="plan-progress-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--rp-accent-gold)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            opacity={fraction > 0 ? 1 : 0}
            className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
          />
        </svg>
        {/* No "০/০" for an empty list: the checklist sign until there is at least one amal. */}
        <span
          role="img"
          aria-label={total > 0 ? t("progressRing", { done: n(done), total: n(total) }) : t("progressEmpty")}
          className="rp-h2 absolute inset-0 flex items-center justify-center tabular-nums"
        >
          {total > 0 ? (
            <span aria-hidden="true">
              {n(done)}/{n(total)}
            </span>
          ) : (
            <PlanIcon size={32} data-testid="plan-progress-empty" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="rp-row font-semibold" data-testid="plan-progress-copy">
          {t(progressCopy(done, total))}
        </p>
        <p className="rp-small mt-1 text-white">{quranParts.length > 0 ? quranParts.join(" · ") : t("progressHint")}</p>
      </div>
    </section>
  );
}
