"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { getDailyLogAction, saveDailyLogAction } from "@/actions/planner";

interface JournalData {
  reflection: string;
  myDua: string;
}

export function JournalSection({ day }: { day: number }) {
  const t = useTranslations("today");
  const { isGuest, loading } = useAuth();

  const { data: guestData, updateData, showPrompt, dismissPrompt } =
    useGuestData<JournalData>(getTodayKey("journal"), {
      reflection: "",
      myDua: "",
    });

  const [serverData, setServerData] = useState<JournalData>({
    reflection: "",
    myDua: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loading || isGuest) return;

    const load = async () => {
      const res = await getDailyLogAction(day);
      if (res.ok && res.data) {
        setServerData(res.data.journal);
      }
    };

    load();
  }, [day, isGuest, loading]);

  useEffect(() => {
    if (loading || isGuest || !dirty) return;

    const timeout = setTimeout(() => {
      saveDailyLogAction({ day, journal: serverData });
      setDirty(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [day, dirty, isGuest, loading, serverData]);

  const data = isGuest ? guestData : serverData;

  const updateField = (field: keyof JournalData, value: string) => {
    if (isGuest) {
      updateData((prev) => ({ ...prev, [field]: value }));
      return;
    }

    setServerData((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
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
