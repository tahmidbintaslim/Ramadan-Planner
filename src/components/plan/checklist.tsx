import type { ReactNode } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { CheckIcon } from "@/components/icons/islamic-icons";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistRowItem {
  id: string;
  title: string;
  done: boolean;
  meta?: string;
}

/** Overline above a group of checklist cards (accent 13/18 500). */
export function ChecklistOverline({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="rp-overline text-rp-accent">
      {children}
    </h2>
  );
}

/** Rounded checklist cards: a round check, the title and an optional meta line (Figma "Checklist Item"). */
export function ChecklistCards({
  items,
  onToggle,
  onEdit,
  canEdit,
  disabled = false,
  pending,
  labelledBy,
  className,
}: {
  items: readonly ChecklistRowItem[];
  onToggle: (item: ChecklistRowItem, done: boolean) => void;
  /** Shows a 48px pencil button per row (not on rows `canEdit` rejects). */
  onEdit?: (item: ChecklistRowItem) => void;
  canEdit?: (item: ChecklistRowItem) => boolean;
  disabled?: boolean;
  /** Ids with a request in flight: their rows are locked. */
  pending?: ReadonlySet<string>;
  labelledBy?: string;
  className?: string;
}) {
  const t = useTranslations("plan");
  return (
    <ul aria-labelledby={labelledBy} className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => {
        const locked = disabled || Boolean(pending?.has(item.id));
        return (
        <li key={item.id} className="flex items-stretch gap-2" data-testid="plan-item" data-done={item.done || undefined}>
          <button
            type="button"
            role="checkbox"
            aria-checked={item.done}
            disabled={locked}
            aria-busy={pending?.has(item.id) || undefined}
            onClick={() => onToggle(item, !item.done)}
            className="flex min-h-[72px] min-w-0 flex-1 items-center gap-4 rounded-rp-lg bg-rp-surface px-4 py-3 text-start text-rp-ink shadow-rp-soft outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-rp-full border-2 transition-colors motion-reduce:transition-none",
                item.done ? "border-rp-done bg-rp-done text-rp-surface" : "border-rp-input",
              )}
            >
              {item.done ? <CheckIcon size={16} strokeWidth={2.4} /> : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn("rp-row break-words", item.done && "text-rp-muted")}>{item.title}</span>
              {item.meta ? <span className="rp-caption text-rp-muted">{item.meta}</span> : null}
            </span>
          </button>
          {onEdit && (canEdit?.(item) ?? true) ? (
            <button
              type="button"
              onClick={() => onEdit(item)}
              disabled={locked}
              aria-label={t("editItem", { title: item.title })}
              className="flex w-12 shrink-0 items-center justify-center rounded-rp-lg bg-rp-surface text-rp-muted shadow-rp-soft outline-none hover:text-rp-accent focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60"
            >
              <Pencil aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </li>
        );
      })}
    </ul>
  );
}
