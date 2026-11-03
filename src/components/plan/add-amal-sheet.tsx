import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PLAN_WINDOWS, windowFromTitle, type PlanWindow } from "./plan-logic";

export interface NewAmal {
  title: string;
  window: PlanWindow;
  /** Set when a target was entered: the item is added as a goal. */
  targetCount?: number;
}

/** "+ নতুন আমল যোগ করুন": a full-width Soft button that opens the add sheet (title, window, optional target). */
export function AddAmalSheet({
  onAdd,
  suggestions,
  disabled,
}: {
  onAdd: (amal: NewAmal) => Promise<boolean>;
  /** Quick titles (the existing checklist templates). */
  suggestions: readonly string[];
  disabled?: boolean;
}) {
  const t = useTranslations("plan");
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [win, setWin] = useState<PlanWindow | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const chosenWindow = win ?? windowFromTitle(title);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || busy) return;
    const count = Number.parseInt(target, 10);
    setBusy(true);
    const ok = await onAdd({
      title: clean,
      window: chosenWindow,
      targetCount: Number.isFinite(count) && count > 0 ? Math.min(1000, count) : undefined,
    });
    setBusy(false);
    if (ok) {
      setTitle("");
      setTarget("");
      setWin(null);
      setOpen(false);
    }
  }

  return (
    <>
      <Button type="button" variant="soft" size="lg" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        + {t("addAmal")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-rp-xl border-0 bg-rp-surface text-rp-ink">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="rp-h2 text-rp-ink">{t("addSheetTitle")}</SheetTitle>
            <SheetDescription className="rp-small text-rp-muted">{t("addSheetDescription")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 px-5 pb-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-title`}>{t("amalTitle")}</Label>
              <Input
                id={`${ids}-title`}
                value={title}
                maxLength={180}
                autoComplete="off"
                onChange={(e) => setTitle(e.target.value)}
              />
              {suggestions.length > 0 ? (
                <div role="group" aria-label={t("suggestions")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                  {suggestions.map((s) => (
                    <Chip key={s} selected={title === s} onClick={() => setTitle(s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
            <div role="radiogroup" aria-labelledby={`${ids}-window`} className="flex flex-col gap-2">
              <span id={`${ids}-window`} className="text-sm font-medium">
                {t("amalWindow")}
              </span>
              <div className="flex flex-wrap gap-2">
                {PLAN_WINDOWS.map((w) => (
                  <Chip
                    key={w}
                    role="radio"
                    aria-checked={chosenWindow === w}
                    aria-pressed={undefined}
                    selected={chosenWindow === w}
                    onClick={() => setWin(w)}
                  >
                    {t(`windows.${w}`)}
                  </Chip>
                ))}
              </div>
            </div>
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
            <Button type="submit" size="lg" disabled={!title.trim() || busy}>
              {t("add")}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
