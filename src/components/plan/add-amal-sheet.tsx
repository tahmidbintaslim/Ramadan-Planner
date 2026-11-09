import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Minus, Plus } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/lib/locale-number";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PLAN_WINDOWS, windowFromTitle, type PlanWindow } from "./plan-logic";

export interface AmalDraft {
  title: string;
  window: PlanWindow;
  /** Set when a target was entered: the item is (or stays) a goal. */
  targetCount?: number;
}

export interface AmalSuggestion {
  title: string;
  /** Goal templates carry a target count. */
  targetCount?: number;
}

/** The item being edited: its kind decides whether the target field is shown (goals only). */
export interface AmalEditTarget {
  id: string;
  kind: "task" | "goal";
  title: string;
  window: PlanWindow;
  targetCount?: number;
}

/** The grouped-list "+ নতুন আমল যোগ করুন" row at the end of the list (Figma D5). */
export function AddAmalButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("plan");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rp-row flex min-h-12 w-full items-center gap-3 rounded-rp-md bg-rp-surface px-4 text-start text-rp-accent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus disabled:opacity-60"
    >
      <Plus aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
      {t("addAmal")}
    </button>
  );
}

const SHEET_CLASS =
  "mx-auto max-h-[90dvh] w-full max-w-2xl gap-0 overflow-y-auto rounded-t-rp-xl border-0 bg-rp-page pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-rp-ink";

/**
 * The add / edit sheet (Figma D5b): Cancel · title · Add in the bar, then one group with the name, the time of day
 * (segmented) and an optional target (a target makes it a goal), then one-tap suggestions. Deleting is a row
 * action with its own confirmation (D5c).
 */
export function AmalSheet({
  open,
  onOpenChange,
  editing,
  suggestions,
  onAdd,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AmalEditTarget | null;
  suggestions: readonly AmalSuggestion[];
  onAdd: (draft: AmalDraft) => Promise<boolean>;
  onSave: (item: AmalEditTarget, draft: AmalDraft) => Promise<boolean>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className={SHEET_CLASS}>
        {/* Keyed so each opening starts from the item's (or empty) values. */}
        {open ? (
          <AmalForm
            key={editing?.id ?? "new"}
            editing={editing}
            suggestions={editing ? [] : suggestions}
            onAdd={onAdd}
            onSave={onSave}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AmalForm({
  editing,
  suggestions,
  onAdd,
  onSave,
  onDone,
}: {
  editing: AmalEditTarget | null;
  suggestions: readonly AmalSuggestion[];
  onAdd: (draft: AmalDraft) => Promise<boolean>;
  onSave: (item: AmalEditTarget, draft: AmalDraft) => Promise<boolean>;
  onDone: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const ids = useId();
  // The target is shown in the locale's digits ("৩৩"); typing either digit set works.
  const shown = (n: number | undefined) => (n ? formatLocalizedNumber(n, locale) : "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [win, setWin] = useState<PlanWindow | null>(editing?.window ?? null);
  const [target, setTarget] = useState(shown(editing?.targetCount));
  const [busy, setBusy] = useState(false);
  const chosenWindow = win ?? windowFromTitle(title);
  const showTarget = !editing || editing.kind === "goal";
  // Either digit set ("১০০" or "100").
  const count = Math.floor(parseLocalizedNumber(target) ?? 0);
  const validCount = count > 0 ? Math.min(1000, count) : 0;
  const step = (by: number) => {
    const next = Math.max(0, Math.min(1000, validCount + by));
    setTarget(shown(next));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || busy) return;
    const draft: AmalDraft = { title: clean, window: chosenWindow, targetCount: showTarget && validCount ? validCount : undefined };
    setBusy(true);
    const ok = await (editing ? onSave(editing, draft) : onAdd(draft));
    setBusy(false);
    if (ok) onDone();
  }

  const barButton =
    "rp-row min-h-11 rounded-rp-sm px-1 text-rp-accent outline-none focus-visible:ring-2 focus-visible:ring-rp-focus disabled:opacity-40";
  const stepButton =
    "flex h-8 w-[46px] items-center justify-center text-rp-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus disabled:opacity-40";

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3 pb-2">
        <button type="button" onClick={onDone} className={cn(barButton, "justify-self-start")}>
          {t("cancel")}
        </button>
        <SheetTitle className="rp-headline text-center text-rp-ink">{editing ? t("editSheetTitle") : t("addSheetTitle")}</SheetTitle>
        <button type="submit" disabled={!title.trim() || busy} className={cn(barButton, "justify-self-end font-semibold")}>
          {editing ? t("save") : t("add")}
        </button>
      </div>
      <SheetDescription className="sr-only">{t("addSheetDescription")}</SheetDescription>

      <div className="mx-4 overflow-hidden rounded-rp-md bg-rp-surface">
        <Label htmlFor={`${ids}-title`} className="sr-only">
          {t("amalTitle")}
        </Label>
        <Input
          id={`${ids}-title`}
          value={title}
          maxLength={180}
          autoComplete="off"
          placeholder={t("amalTitle")}
          onChange={(e) => setTitle(e.target.value)}
          className="rp-row h-[52px] rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-2 focus-visible:ring-inset"
        />
        <div className="border-t border-rp-rule px-4 py-2">
          <span id={`${ids}-window`} className="sr-only">
            {t("amalWindow")}
          </span>
          <div role="radiogroup" aria-labelledby={`${ids}-window`} className="grid h-9 grid-cols-3 rounded-rp-sm bg-rp-accent-tint p-0.5">
            {PLAN_WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={chosenWindow === w}
                onClick={() => setWin(w)}
                className={cn(
                  "rp-small rounded-[6px] px-1 outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
                  chosenWindow === w ? "bg-rp-surface font-semibold text-rp-ink shadow-rp-soft" : "text-rp-muted hover:text-rp-ink",
                )}
              >
                {t(`windowsShort.${w}`)}
              </button>
            ))}
          </div>
        </div>
        {showTarget ? (
          <div className="flex min-h-[52px] items-center gap-3 border-t border-rp-rule px-4">
            <Label htmlFor={`${ids}-target`} className="sr-only">
              {t("amalTarget")}
            </Label>
            <span className="rp-row flex min-w-0 flex-1 items-center gap-1.5">
              <Input
                id={`${ids}-target`}
                inputMode="numeric"
                autoComplete="off"
                value={target}
                placeholder={t("noTarget")}
                onChange={(e) => setTarget(e.target.value.replace(/[^\d০-৯]/g, ""))}
                aria-describedby={`${ids}-target-hint`}
                // Sized to its text so the unit sits right after the number (field-sizing is not in every browser yet).
                style={{ width: `${(target || t("noTarget")).length * 0.7 + 0.6}em` }}
                className="rp-row h-10 min-w-0 max-w-full rounded-rp-sm border-0 bg-transparent px-0 shadow-none"
              />
              {validCount ? <span className="text-rp-muted">{t("timesUnit")}</span> : null}
            </span>
            <span className="flex shrink-0 items-center overflow-hidden rounded-rp-sm bg-rp-accent-tint">
              <button type="button" aria-label={t("targetLess")} disabled={!validCount} onClick={() => step(-1)} className={stepButton}>
                <Minus aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </button>
              <span aria-hidden="true" className="h-4 w-px bg-rp-rule" />
              <button type="button" aria-label={t("targetMore")} disabled={validCount >= 1000} onClick={() => step(1)} className={stepButton}>
                <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </button>
            </span>
          </div>
        ) : null}
      </div>
      {showTarget ? (
        <p id={`${ids}-target-hint`} className="rp-caption px-8 text-rp-muted">
          {t("amalTargetHint")}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <div role="group" aria-label={t("suggestions")} className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1">
          {suggestions.map((s) => (
            <Chip
              key={s.title}
              selected={title === s.title}
              onClick={() => {
                setTitle(s.title);
                setTarget(shown(s.targetCount));
              }}
            >
              {s.title}
            </Chip>
          ))}
        </div>
      ) : null}
    </form>
  );
}

/** The delete confirmation (Figma D5c): an action sheet with the destructive action and a separate Cancel. */
export function DeleteAmalSheet({
  item,
  onOpenChange,
  onConfirm,
}: {
  item: AmalEditTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (item: AmalEditTarget) => Promise<boolean>;
}) {
  const t = useTranslations("plan");
  const [busy, setBusy] = useState(false);
  const button = "rp-row min-h-14 w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus disabled:opacity-60";
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto w-full max-w-md gap-2 border-0 bg-transparent px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-none"
      >
        <div className="overflow-hidden rounded-rp-lg bg-rp-surface text-center">
          <SheetHeader className="gap-1 px-4 py-3">
            <SheetTitle className="rp-small font-semibold text-rp-ink">{t("deleteConfirmTitle", { title: item?.title ?? "" })}</SheetTitle>
            <SheetDescription className="rp-caption text-rp-muted">{t("deleteConfirmBody")}</SheetDescription>
          </SheetHeader>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!item || busy) return;
              setBusy(true);
              const ok = await onConfirm(item);
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
            className={cn(button, "border-t border-rp-rule text-destructive")}
          >
            {t("deleteItem")}
          </button>
        </div>
        <button type="button" onClick={() => onOpenChange(false)} className={cn(button, "rounded-rp-lg bg-rp-surface font-semibold text-rp-accent")}>
          {t("cancel")}
        </button>
      </SheetContent>
    </Sheet>
  );
}
