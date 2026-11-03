import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** "+ নতুন আমল যোগ করুন": a full-width Soft button that opens the add sheet (title, window, optional target). */
export function AddAmalButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("plan");
  return (
    <Button type="button" variant="soft" size="lg" className="w-full" disabled={disabled} onClick={onClick}>
      + {t("addAmal")}
    </Button>
  );
}

/**
 * The add / edit sheet. Add mode: title with one-tap suggestions (checklist and goal templates), window, optional
 * target (a target makes it a goal). Edit mode (`editing` set): the same fields prefilled, plus delete.
 */
export function AmalSheet({
  open,
  onOpenChange,
  editing,
  suggestions,
  onAdd,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AmalEditTarget | null;
  suggestions: readonly AmalSuggestion[];
  onAdd: (draft: AmalDraft) => Promise<boolean>;
  onSave: (item: AmalEditTarget, draft: AmalDraft) => Promise<boolean>;
  onDelete: (item: AmalEditTarget) => Promise<boolean>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-rp-xl border-0 bg-rp-surface text-rp-ink">
        {/* Keyed so each opening starts from the item's (or empty) values. */}
        {open ? (
          <AmalForm
            key={editing?.id ?? "new"}
            editing={editing}
            suggestions={editing ? [] : suggestions}
            onAdd={onAdd}
            onSave={onSave}
            onDelete={onDelete}
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
  onDelete,
  onDone,
}: {
  editing: AmalEditTarget | null;
  suggestions: readonly AmalSuggestion[];
  onAdd: (draft: AmalDraft) => Promise<boolean>;
  onSave: (item: AmalEditTarget, draft: AmalDraft) => Promise<boolean>;
  onDelete: (item: AmalEditTarget) => Promise<boolean>;
  onDone: () => void;
}) {
  const t = useTranslations("plan");
  const ids = useId();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [win, setWin] = useState<PlanWindow | null>(editing?.window ?? null);
  const [target, setTarget] = useState(editing?.targetCount ? String(editing.targetCount) : "");
  const [busy, setBusy] = useState(false);
  const chosenWindow = win ?? windowFromTitle(title);
  const showTarget = !editing || editing.kind === "goal";

  async function run(action: () => Promise<boolean>) {
    if (busy) return;
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onDone();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const count = Number.parseInt(target, 10);
    const draft: AmalDraft = {
      title: clean,
      window: chosenWindow,
      targetCount: showTarget && Number.isFinite(count) && count > 0 ? Math.min(1000, count) : undefined,
    };
    void run(() => (editing ? onSave(editing, draft) : onAdd(draft)));
  }

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-0">
        <SheetTitle className="rp-h2 text-rp-ink">{editing ? t("editSheetTitle") : t("addSheetTitle")}</SheetTitle>
        <SheetDescription className="rp-small text-rp-muted">{t("addSheetDescription")}</SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} className="flex flex-col gap-5 px-5 pb-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-title`}>{t("amalTitle")}</Label>
          <Input id={`${ids}-title`} value={title} maxLength={180} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
          {suggestions.length > 0 ? (
            <div role="group" aria-label={t("suggestions")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {suggestions.map((s) => (
                <Chip
                  key={s.title}
                  selected={title === s.title}
                  onClick={() => {
                    setTitle(s.title);
                    setTarget(s.targetCount ? String(s.targetCount) : "");
                  }}
                >
                  {s.title}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
        <div role="group" aria-labelledby={`${ids}-window`} className="flex flex-col gap-2">
          <span id={`${ids}-window`} className="text-sm font-medium">
            {t("amalWindow")}
          </span>
          <div className="flex flex-wrap gap-2">
            {PLAN_WINDOWS.map((w) => (
              <Chip key={w} selected={chosenWindow === w} onClick={() => setWin(w)}>
                {t(`windows.${w}`)}
              </Chip>
            ))}
          </div>
        </div>
        {showTarget ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-target`}>{t("amalTarget")}</Label>
            <Input
              id={`${ids}-target`}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-describedby={`${ids}-target-hint`}
              className="max-w-40"
            />
            <p id={`${ids}-target-hint`} className="rp-caption text-rp-muted">
              {t("amalTargetHint")}
            </p>
          </div>
        ) : null}
        <Button type="submit" size="lg" disabled={!title.trim() || busy}>
          {editing ? t("save") : t("add")}
        </Button>
        {editing ? (
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => onDelete(editing))}>
            {t("deleteItem")}
          </Button>
        ) : null}
      </form>
    </>
  );
}
