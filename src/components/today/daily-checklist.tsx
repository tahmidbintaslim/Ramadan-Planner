"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { getDailyLogAction, saveDailyLogAction } from "@/actions/planner";

const CHECKLIST_ITEMS = [
  "morningDhikr",
  "eveningDhikr",
  "istighfar",
  "charity",
  "goodDeeds",
  "durud",
] as const;

type ChecklistKey = (typeof CHECKLIST_ITEMS)[number];

export function DailyChecklist({ day }: { day: number }) {
  const t = useTranslations("checklist");
  const tToday = useTranslations("today");
  const { isGuest, loading } = useAuth();
  const [isPending, startTransition] = useTransition();

  const {
    data: guestChecked,
    updateData: setGuestChecked,
    showPrompt,
    dismissPrompt,
  } = useGuestData<Record<string, boolean>>(getTodayKey("checklist"), {});

  const [serverChecked, setServerChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (loading || isGuest) return;

    startTransition(async () => {
      const res = await getDailyLogAction(day);
      if (res.ok && res.data) {
        const next: Record<string, boolean> = {};
        for (const key of res.data.checklist) {
          next[key] = true;
        }
        setServerChecked(next);
      }
    });
  }, [day, isGuest, loading]);

  const checked = isGuest ? guestChecked : serverChecked;

  const toggleItem = (item: ChecklistKey) => {
    if (isGuest) {
      setGuestChecked((prev) => ({
        ...prev,
        [item]: !prev[item],
      }));
      return;
    }

    const next = { ...serverChecked, [item]: !serverChecked[item] };
    setServerChecked(next);

    const selected = Object.entries(next)
      .filter(([, value]) => value)
      .map(([key]) => key);

    startTransition(async () => {
      await saveDailyLogAction({ day, checklist: selected });
    });
  };

  const completedCount = Object.values(checked).filter(Boolean).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{tToday("checklist")}</CardTitle>
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
                  onCheckedChange={() => toggleItem(item)}
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
