"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { getDailyLogAction, saveDailyLogAction } from "@/actions/planner";

interface QuranData {
  para: string;
  surah: string;
  ayah: string;
  pages: string;
}

export function QuranTracker({ day }: { day: number }) {
  const t = useTranslations("quran");
  const tToday = useTranslations("today");
  const { isGuest, loading } = useAuth();

  const { data: guestData, updateData, showPrompt, dismissPrompt } =
    useGuestData<QuranData>(getTodayKey("quran"), {
      para: "",
      surah: "",
      ayah: "",
      pages: "",
    });

  const [serverData, setServerData] = useState<QuranData>({
    para: "",
    surah: "",
    ayah: "",
    pages: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loading || isGuest) return;

    const load = async () => {
      const res = await getDailyLogAction(day);
      if (res.ok && res.data) {
        setServerData(res.data.quran);
      }
    };

    load();
  }, [day, isGuest, loading]);

  useEffect(() => {
    if (loading || isGuest || !dirty) return;

    const timeout = setTimeout(() => {
      saveDailyLogAction({ day, quran: serverData });
      setDirty(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [day, dirty, isGuest, loading, serverData]);

  const data = isGuest ? guestData : serverData;

  const updateField = (field: keyof QuranData, value: string) => {
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
          <CardTitle className="text-base">{tToday("quranTracker")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="para" className="text-xs">
                {t("para")}
              </Label>
              <Input
                id="para"
                type="number"
                min="1"
                max="30"
                placeholder="1-30"
                value={data.para}
                onChange={(e) => updateField("para", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surah" className="text-xs">
                {t("surah")}
              </Label>
              <Input
                id="surah"
                placeholder={t("surah")}
                value={data.surah}
                onChange={(e) => updateField("surah", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ayah" className="text-xs">
                {t("ayah")}
              </Label>
              <Input
                id="ayah"
                type="number"
                min="1"
                placeholder="1"
                value={data.ayah}
                onChange={(e) => updateField("ayah", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pages" className="text-xs">
                {t("page")}
              </Label>
              <Input
                id="pages"
                type="number"
                min="0"
                placeholder="0"
                value={data.pages}
                onChange={(e) => updateField("pages", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
