"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";

interface QuranData {
  para: string;
  surah: string;
  ayah: string;
  pages: string;
}

export function QuranTracker() {
  const t = useTranslations("quran");
  const tToday = useTranslations("today");

  const { data, updateData, showPrompt, dismissPrompt } =
    useGuestData<QuranData>(getTodayKey("quran"), {
      para: "",
      surah: "",
      ayah: "",
      pages: "",
    });

  const updateField = (field: keyof QuranData, value: string) => {
    updateData((prev) => ({ ...prev, [field]: value }));
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
