import { useState, type ComponentType } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { SectionHeader } from "@/components/design/section-header";
import { Link } from "@/components/shared/link";
import { buttonVariants } from "@/components/ui/button";
import {
  CheckIcon,
  DuaIcon,
  LanternIcon,
  QuranIcon,
  TasbihIcon,
  ZakatIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";
import { formatLocalizedNumber } from "@/lib/locale-number";
import type { PrayerPhase } from "@/lib/prayer-phase";
import { cn } from "@/lib/utils";
import { CHECKLIST_ITEMS, type ChecklistKey, type DailyChecklistState } from "./use-daily-checklist";

// ── Phase card: Sehri niyyah / Iftar dua ──────────────

export type PhaseCardKind = "niyyah" | "iftarDua";

/** Which card follows the Sehri/Iftar pair: the niyyah in the Sehri phase (Ramadan), the iftar dua in the last hour. */
export function phaseCardKind(phase: PrayerPhase | null | undefined, ramadan: boolean): PhaseCardKind | null {
  if (phase === "sehri" && ramadan) return "niyyah";
  if (phase === "iftar") return "iftarDua";
  return null;
}

export function PhaseCard({ kind, className }: { kind: PhaseCardKind; className?: string }) {
  const t = useTranslations("home");
  const titleId = `phase-card-${kind}`;
  return (
    <section
      aria-labelledby={titleId}
      data-testid="phase-card"
      data-kind={kind}
      className={cn("flex flex-col gap-2 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft", className)}
    >
      <h2 id={titleId} className="rp-row flex items-center gap-2 font-semibold">
        <DuaIcon size={24} className="text-rp-accent" />
        {t(kind === "niyyah" ? "niyyahTitle" : "iftarDuaTitle")}
      </h2>
      <p className="rp-h2">{t(kind === "niyyah" ? "niyyahText" : "iftarDuaText")}</p>
      <p className="rp-small text-rp-muted">{t(kind === "niyyah" ? "niyyahMeaning" : "iftarDuaMeaning")}</p>
      <p className="rp-caption text-rp-gold-text">{t(kind === "niyyah" ? "niyyahSource" : "iftarDuaSource")}</p>
    </section>
  );
}

// ── Feature tiles ─────────────────────────────────────

export const FEATURE_TILES: ReadonlyArray<{
  key: "tileQuran" | "tileDuas" | "tileTasbih" | "tileZakat";
  href: string;
  Icon: ComponentType<IconProps>;
}> = [
  { key: "tileQuran", href: "/quran", Icon: QuranIcon },
  { key: "tileDuas", href: "/duas", Icon: DuaIcon },
  { key: "tileTasbih", href: "/tasbih", Icon: TasbihIcon },
  { key: "tileZakat", href: "/zakat", Icon: ZakatIcon },
];

export function FeatureTiles({ className }: { className?: string }) {
  const t = useTranslations("home");
  return (
    <section aria-labelledby="home-companions" className={cn("flex flex-col gap-3", className)}>
      <SectionHeader title={<span id="home-companions">{t("companions")}</span>} />
      <ul className="grid grid-cols-4 gap-3">
        {FEATURE_TILES.map(({ key, href, Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-rp-md bg-rp-surface px-1 py-4 text-rp-ink shadow-rp-soft transition-colors outline-none hover:bg-rp-accent-tint/60 focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span className="flex size-11 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
                <Icon size={24} />
              </span>
              <span className="text-[13px] leading-[18px] font-medium">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Today's plan preview ──────────────────────────────

export const PLAN_PREVIEW_COUNT = 3;
export const PLAN_HREF = "/plan";

export function PlanPreview({ state, className }: { state: DailyChecklistState; className?: string }) {
  const t = useTranslations("home");
  const tItem = useTranslations("checklist");
  const locale = useLocale();
  const items: readonly ChecklistKey[] = CHECKLIST_ITEMS.slice(0, PLAN_PREVIEW_COUNT);
  const done = CHECKLIST_ITEMS.filter((k) => state.checked[k]).length;

  return (
    <section aria-labelledby="home-plan" className={cn("flex flex-col gap-3", className)}>
      <SectionHeader
        title={
          <span id="home-plan">
            {t("planTitle", {
              done: formatLocalizedNumber(done, locale),
              total: formatLocalizedNumber(CHECKLIST_ITEMS.length, locale),
            })}
          </span>
        }
        action={
          <Link href={PLAN_HREF} aria-label={t("planAllLabel")}>
            {t("planAll")}
          </Link>
        }
      />
      <ul className="flex flex-col gap-3">
        {items.map((key) => {
          const checked = Boolean(state.checked[key]);
          return (
            <li key={key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={state.isPending}
                onClick={() => state.toggle(key)}
                data-testid={`plan-item-${key}`}
                className="flex min-h-[72px] w-full items-center gap-4 rounded-rp-lg bg-rp-surface px-4 py-3 text-left text-rp-ink shadow-rp-soft outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-rp-full border-2",
                    checked ? "border-rp-done bg-rp-done text-rp-surface" : "border-rp-input",
                  )}
                >
                  {checked ? <CheckIcon size={16} strokeWidth={2.4} /> : null}
                </span>
                <span className={cn("rp-row", checked && "text-rp-muted")}>{tItem(key)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Support (sadaqah) card ────────────────────────────

/** Placeholder until the Support page lands (Task 10). */
export const SUPPORT_HREF = "/support";

export function SupportCard({
  lastTen,
  onDismiss,
  className,
}: {
  lastTen: boolean;
  onDismiss: () => void;
  className?: string;
}) {
  const t = useTranslations("home");
  // Hides at once even when storage is unavailable (the stored dismissal then cannot persist).
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section
      aria-labelledby="home-support"
      data-testid="support-card"
      className={cn("flex items-start gap-4 rounded-rp-lg bg-rp-gold-tint p-5 text-rp-ink shadow-rp-soft", className)}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-rp-full bg-rp-surface text-rp-gold-text">
        <LanternIcon size={24} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="home-support" className="rp-row font-semibold">
          {t(lastTen ? "supportTitleLastTen" : "supportTitle")}
        </h2>
        <p className="rp-small text-rp-muted">{t("supportBody")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Link
            href={SUPPORT_HREF}
            className="rp-small inline-flex min-h-12 items-center font-semibold text-rp-gold-text underline-offset-4 hover:underline"
          >
            {t("supportAction")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              onDismiss();
            }}
            aria-label={t("supportDismissLabel")}
            className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "ml-auto min-h-12 text-rp-muted")}
          >
            {t("supportDismiss")}
          </button>
        </div>
      </div>
    </section>
  );
}
