"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/icons/islamic-icons";
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
      {/* Optional reflection, collapsed by default (native details: keyboard and screen-reader friendly). */}
      <Card className="py-0">
        <details className="group" data-testid="journal">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-rp-lg px-6 py-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col">
              <span role="heading" aria-level={2} className="rp-h2 text-rp-ink">
                {t("journal")}
              </span>
              <span className="rp-caption text-rp-muted">{t("journalOptional")}</span>
            </span>
            <ChevronRightIcon size={20} className="shrink-0 text-rp-muted transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          </summary>
        <CardContent className="space-y-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="reflection" className="rp-small text-rp-ink">
              {t("reflection")}
            </Label>
            <textarea
              id="reflection"
              rows={3}
              placeholder={t("reflectionPlaceholder")}
              value={data.reflection}
              onChange={(e) => updateField("reflection", e.target.value)}
              className="rp-body flex min-h-24 w-full resize-none rounded-rp-md border border-rp-input bg-rp-surface px-4 py-3 text-rp-ink placeholder:text-rp-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-dua" className="rp-small text-rp-ink">
              {t("myDua")}
            </Label>
            <textarea
              id="my-dua"
              rows={3}
              placeholder={t("myDuaPlaceholder")}
              value={data.myDua}
              onChange={(e) => updateField("myDua", e.target.value)}
              className="rp-body flex min-h-24 w-full resize-none rounded-rp-md border border-rp-input bg-rp-surface px-4 py-3 text-rp-ink placeholder:text-rp-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            />
          </div>
        </CardContent>
        </details>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
