import { useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { CheckIcon } from "@/components/icons/islamic-icons";
import { cn } from "@/lib/utils";

export interface ChecklistRowItem {
  id: string;
  title: string;
  done: boolean;
  meta?: string;
}

/** Width of the two revealed actions (Figma D5: 2 × 74). */
const ACTIONS_W = 148;
/** Hairline inset to the text, past the 44pt check (Figma D5 separator). */
const ROW_DIVIDER =
  "relative after:absolute after:right-0 after:bottom-0 after:left-[60px] after:h-px after:bg-rp-rule last:after:hidden";

const FINE_HOVER = "(hover: hover) and (pointer: fine)";
// Old webviews (and jsdom) have no matchMedia: treat them as touch.
const hoverQuery = () => (typeof window.matchMedia === "function" ? window.matchMedia(FINE_HOVER) : null);
const subscribeHover = (cb: () => void) => {
  const mq = hoverQuery();
  mq?.addEventListener("change", cb);
  return () => mq?.removeEventListener("change", cb);
};
/** A mouse or trackpad: row actions show on hover/focus instead of a swipe (nobody swipes with a mouse). */
export function useFineHover(): boolean {
  return useSyncExternalStore(subscribeHover, () => hoverQuery()?.matches ?? false, () => false);
}

/** Heading above a group: h2 like every section heading; h3 is the small grouped-list caption (Figma D5). */
export function ChecklistOverline({ id, children, as: Heading = "h2" }: { id?: string; children: ReactNode; as?: "h2" | "h3" }) {
  return (
    <Heading id={id} className={Heading === "h2" ? "rp-h2 text-rp-ink" : "rp-caption px-4 text-rp-muted"}>
      {children}
    </Heading>
  );
}

/**
 * A grouped list of amal (Figma D5): a 44pt round check, the title and an optional meta line. Rows that can be
 * edited swipe left to reveal Edit and Delete; the two buttons are also reachable by keyboard (focusing one opens
 * its row) and by screen readers.
 */
export function ChecklistCards({
  items,
  onToggle,
  onEdit,
  onDelete,
  canEdit,
  disabled = false,
  pending,
  labelledBy,
  className,
}: {
  items: readonly ChecklistRowItem[];
  onToggle: (item: ChecklistRowItem, done: boolean) => void;
  onEdit?: (item: ChecklistRowItem) => void;
  onDelete?: (item: ChecklistRowItem) => void;
  /** Rows it rejects get no actions. */
  canEdit?: (item: ChecklistRowItem) => boolean;
  disabled?: boolean;
  /** Ids with a request in flight: their rows are locked. */
  pending?: ReadonlySet<string>;
  labelledBy?: string;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ul aria-labelledby={labelledBy} className={cn("overflow-hidden rounded-rp-md bg-rp-surface", className)}>
      {items.map((item) => (
        <SwipeRow
          key={item.id}
          item={item}
          locked={disabled || Boolean(pending?.has(item.id))}
          busy={Boolean(pending?.has(item.id))}
          open={openId === item.id}
          anyOpen={openId !== null}
          setOpen={(open) => setOpenId(open ? item.id : null)}
          onToggle={onToggle}
          onEdit={onEdit && (canEdit?.(item) ?? true) ? onEdit : undefined}
          onDelete={onDelete && (canEdit?.(item) ?? true) ? onDelete : undefined}
        />
      ))}
    </ul>
  );
}

function SwipeRow({
  item,
  locked,
  busy,
  open,
  anyOpen,
  setOpen,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ChecklistRowItem;
  locked: boolean;
  busy: boolean;
  open: boolean;
  anyOpen: boolean;
  setOpen: (open: boolean) => void;
  onToggle: (item: ChecklistRowItem, done: boolean) => void;
  onEdit?: (item: ChecklistRowItem) => void;
  onDelete?: (item: ChecklistRowItem) => void;
}) {
  const t = useTranslations("plan");
  const hover = useFineHover();
  const hasActions = Boolean(onEdit || onDelete) && !locked;
  const swipeable = hasActions && !hover;
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  // A swipe ends with a click on the check: that click must not tick the row.
  const swallowClick = useRef(false);

  const onPointerDown = (e: PointerEvent) => {
    if (!swipeable) return;
    start.current = { x: e.clientX, y: e.clientY, base: open ? -ACTIONS_W : 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (drag === null && (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(e.clientY - s.y))) return;
    setDrag(Math.max(-ACTIONS_W, Math.min(0, s.base + dx)));
  };
  const onPointerEnd = () => {
    if (drag !== null) {
      swallowClick.current = true;
      setOpen(drag < -ACTIONS_W / 2);
    }
    start.current = null;
    setDrag(null);
  };

  const offset = drag ?? (open ? -ACTIONS_W : 0);
  const actionClass =
    "rp-small flex w-[74px] items-center justify-center px-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus";

  return (
    <li
      className={cn(ROW_DIVIDER, "group relative flex overflow-hidden")}
      data-testid="plan-item"
      data-done={item.done || undefined}
      data-open={open || undefined}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {hasActions ? (
        <div
          className={cn(
            "flex",
            hover
              ? "order-last opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none"
              : // Transparent until revealed: the red otherwise fringes the card's rounded corners.
                cn("absolute inset-y-0 right-0", !open && drag === null && "opacity-0"),
          )}
          onFocus={() => !hover && setOpen(true)}
        >
          {onEdit ? (
            <button
              type="button"
              aria-label={t("editItem", { title: item.title })}
              onClick={() => {
                setOpen(false);
                onEdit(item);
              }}
              className={cn(actionClass, hover ? "text-rp-accent hover:bg-rp-accent-tint" : "bg-rp-inverse text-rp-on-inverse")}
            >
              {t("editShort")}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              aria-label={t("deleteItemNamed", { title: item.title })}
              onClick={() => {
                setOpen(false);
                onDelete(item);
              }}
              className={cn(actionClass, hover ? "text-destructive hover:bg-destructive/10" : "bg-destructive text-white")}
            >
              {t("deleteShort")}
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        disabled={locked}
        aria-busy={busy || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          // Like iOS: a tap while a row is open only closes it.
          if (anyOpen) {
            setOpen(false);
            return;
          }
          onToggle(item, !item.done);
        }}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, touchAction: swipeable ? "pan-y" : undefined }}
        className={cn(
          "relative flex min-h-12 min-w-0 flex-1 items-center gap-2 bg-rp-surface py-1 pe-4 ps-2 text-start text-rp-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus disabled:opacity-60",
          drag === null && "transition-transform duration-200 motion-reduce:transition-none",
        )}
      >
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-rp-full border-2 transition-colors motion-reduce:transition-none",
              item.done ? "border-rp-done bg-rp-done text-rp-surface" : "border-rp-input",
            )}
          >
            {item.done ? <CheckIcon size={16} className="rp-pop" /> : null}
          </span>
        </span>
        <span className="flex min-w-0 flex-col py-1">
          <span className={cn("rp-row break-words", item.done && "text-rp-muted")}>{item.title}</span>
          {item.meta ? <span className="rp-caption text-rp-muted">{item.meta}</span> : null}
        </span>
      </button>
    </li>
  );
}
