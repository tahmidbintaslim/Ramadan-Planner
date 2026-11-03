"use client";

import { useTranslations } from "@/i18n/use-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { CHECKLIST_ITEMS, useDailyChecklist, type DailyChecklistState } from "./use-daily-checklist";

/**
 * The daily dhikr and good-deeds checklist (a different list from today's plan on /plan). Pass `state` to share
 * the parent's copy; otherwise it loads its own.
 */
export function DailyChecklist({ day, state }: { day: number; state?: DailyChecklistState }) {
  if (state) return <DailyChecklistCard state={state} />;
  return <OwnDailyChecklist day={day} />;
}

function OwnDailyChecklist({ day }: { day: number }) {
  const state = useDailyChecklist(day);
  return <DailyChecklistCard state={state} />;
}

function DailyChecklistCard({ state }: { state: DailyChecklistState }) {
  const t = useTranslations("checklist");
  const tToday = useTranslations("today");
  const { checked, toggle, isPending, showPrompt, dismissPrompt } = state;
  const completedCount = CHECKLIST_ITEMS.filter((item) => checked[item]).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{tToday("dhikrChecklist")}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{CHECKLIST_ITEMS.length}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Checkbox
                  id={item}
                  checked={checked[item] || false}
                  onCheckedChange={() => toggle(item)}
                  disabled={isPending}
                />
                <Label htmlFor={item} className="text-sm font-normal cursor-pointer">
                  {t(item)}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
