"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useGuestData } from "@/hooks/use-guest-data";
import { useLocalDayKey, useLocalTodayISO } from "@/hooks/use-local-day";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { saveDailyLogAction } from "@/actions/planner";
import { useServerDailyLogField } from "./use-server-daily-log";
import { TrackerError } from "./tracker-error";

// The five daily prayers only: taraweeh and tahajjud are amal on the checklist (তারাবি, the last ten nights' list),
// so no prayer is recorded in two places. Older logs may still hold taraweeh/tahajjud keys; they are kept as is.
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

type PrayerName = (typeof PRAYERS)[number];

const pickPrayers = (log: { prayers: Record<string, boolean> } | null) => log?.prayers ?? {};

export function SalahTracker({ day }: { day: number }) {
  const t = useTranslations("salah");
  const tToday = useTranslations("today");
  const { isGuest, loading } = useAuth();
  const todayISO = useLocalTodayISO();

  const {
    data: guestCompleted,
    updateData: setGuestCompleted,
    showPrompt,
    dismissPrompt,
  } = useGuestData<Record<string, boolean>>(useLocalDayKey("salah"), {});

  const signedIn = !loading && !isGuest;
  const server = useServerDailyLogField(day, todayISO, signedIn, pickPrayers);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const completed = isGuest ? guestCompleted : (server.value ?? {});
  // Signed in: locked until the day's log has loaded, and while a save is in flight (each save sends the whole set).
  const locked = !isGuest && (server.value === null || saving);

  const togglePrayer = (prayer: PrayerName) => {
    if (isGuest) {
      setGuestCompleted((prev) => ({
        ...prev,
        [prayer]: !prev[prayer],
      }));
      return;
    }

    if (locked || server.value === null) return;
    const before = server.value;
    const next = { ...before, [prayer]: !before[prayer] };
    server.setValue(() => next);
    setSaving(true);
    const rollback = () => {
      server.setValue(() => before);
      setSaveFailed(true);
    };
    saveDailyLogAction({ day, logDate: todayISO, prayers: next })
      .then((res) => {
        if (res.ok) {
          server.setValue(() => res.data.prayers);
          setSaveFailed(false);
        } else {
          rollback();
        }
      })
      .catch(rollback)
      .finally(() => setSaving(false));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2 id="plan-salah" className="rp-h2 text-rp-ink">{tToday("salahTracker")}</h2>
        </CardHeader>
        <CardContent>
          <div role="group" aria-labelledby="plan-salah" className="grid grid-cols-5 gap-2">
            {PRAYERS.map((prayer) => {
              const isDone = completed[prayer];
              return (
                <button
                  key={prayer}
                  type="button"
                  aria-pressed={Boolean(isDone)}
                  onClick={() => togglePrayer(prayer)}
                  disabled={locked}
                  className={cn(
                    "flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-rp-md border px-1 py-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                    isDone
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-rp-rule bg-rp-surface text-rp-ink hover:bg-rp-accent-tint",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors",
                      isDone
                        ? "border-primary-foreground bg-primary-foreground/20"
                        : "border-rp-input",
                    )}
                  >
                    {isDone && (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-[13px] leading-[18px] font-medium">{t(prayer)}</span>
                </button>
              );
            })}
          </div>
          <TrackerError loadFailed={server.loadFailed} saveFailed={saveFailed} />
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
