"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/icons/islamic-icons";
import { Label } from "@/components/ui/label";
import { useGuestData } from "@/hooks/use-guest-data";
import { useLocalDayKey, useLocalTodayISO } from "@/hooks/use-local-day";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { saveDailyLogAction } from "@/actions/planner";
import { JOURNAL_MAX } from "@/actions/planner-schemas";
import { useServerDailyLogField } from "./use-server-daily-log";
import { TrackerError } from "./tracker-error";

interface JournalData {
  reflection: string;
  myDua: string;
}

const EMPTY_JOURNAL: JournalData = { reflection: "", myDua: "" };
const pickJournal = (log: { journal: JournalData } | null): JournalData => log?.journal ?? EMPTY_JOURNAL;

export function JournalSection({ day }: { day: number }) {
  const t = useTranslations("today");
  const { isGuest, loading } = useAuth();
  const todayISO = useLocalTodayISO();

  const { data: guestData, updateData, showPrompt, dismissPrompt } =
    useGuestData<JournalData>(useLocalDayKey("journal"), EMPTY_JOURNAL);

  const signedIn = !loading && !isGuest;
  const server = useServerDailyLogField(day, todayISO, signedIn, pickJournal);
  const serverData = server.value ?? EMPTY_JOURNAL;
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const latestRef = useRef(serverData);

  useEffect(() => {
    latestRef.current = serverData;
  }, [serverData]);

  useEffect(() => {
    if (!signedIn || !dirty || server.value === null) return;

    const snapshot = serverData;
    const payload = JSON.stringify(snapshot);
    const timeout = setTimeout(() => {
      saveDailyLogAction({ day, logDate: todayISO, journal: snapshot })
        .then((res) => res.ok)
        .catch(() => false)
        .then((ok) => {
          // The text stays as typed either way; a failed save shows the error and is retried on the next edit.
          setSaveFailed(!ok);
          if (JSON.stringify(latestRef.current) === payload) setDirty(false);
        });
    }, 500);

    return () => clearTimeout(timeout);
  }, [day, dirty, signedIn, serverData, server.value, todayISO]);

  const data = isGuest ? guestData : serverData;
  // Signed in: writing waits for the day's log (an edit before it would save over the stored entry).
  const locked = !isGuest && server.value === null;

  const updateField = (field: keyof JournalData, value: string) => {
    if (isGuest) {
      updateData((prev) => ({ ...prev, [field]: value }));
      return;
    }

    if (locked) return;
    server.setValue((prev) => ({ ...prev, [field]: value }));
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
              maxLength={JOURNAL_MAX}
              disabled={locked}
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
              maxLength={JOURNAL_MAX}
              disabled={locked}
              placeholder={t("myDuaPlaceholder")}
              value={data.myDua}
              onChange={(e) => updateField("myDua", e.target.value)}
              className="rp-body flex min-h-24 w-full resize-none rounded-rp-md border border-rp-input bg-rp-surface px-4 py-3 text-rp-ink placeholder:text-rp-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            />
          </div>
          <TrackerError loadFailed={server.loadFailed} saveFailed={saveFailed} />
        </CardContent>
        </details>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
