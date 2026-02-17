"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";

const CHECKLIST_ITEMS = [
  "morningDhikr",
  "eveningDhikr",
  "istighfar",
  "charity",
  "goodDeeds",
  "durud",
] as const;

type ChecklistKey = (typeof CHECKLIST_ITEMS)[number];

export function DailyChecklist() {
  const t = useTranslations("checklist");
  const tToday = useTranslations("today");

  const {
    data: checked,
    updateData: setChecked,
    showPrompt,
    dismissPrompt,
  } = useGuestData<Record<string, boolean>>(getTodayKey("checklist"), {});

  const toggleItem = (item: ChecklistKey) => {
    setChecked((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
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
                />
                <Label
                  htmlFor={item}
                  className="text-sm font-normal cursor-pointer"
                >
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
