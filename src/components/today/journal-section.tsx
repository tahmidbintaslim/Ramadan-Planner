"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";

interface JournalData {
  reflection: string;
  myDua: string;
}

export function JournalSection() {
  const t = useTranslations("today");

  const { data, updateData, showPrompt, dismissPrompt } =
    useGuestData<JournalData>(getTodayKey("journal"), {
      reflection: "",
      myDua: "",
    });

  const updateField = (field: keyof JournalData, value: string) => {
    updateData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("journal")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reflection" className="text-xs">
              {t("reflection")}
            </Label>
            <textarea
              id="reflection"
              rows={3}
              placeholder={t("reflection")}
              value={data.reflection}
              onChange={(e) => updateField("reflection", e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-dua" className="text-xs">
              {t("myDua")}
            </Label>
            <textarea
              id="my-dua"
              rows={3}
              placeholder={t("myDua")}
              value={data.myDua}
              onChange={(e) => updateField("myDua", e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
