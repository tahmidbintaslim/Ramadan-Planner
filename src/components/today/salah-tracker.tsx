"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";

const PRAYERS = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "taraweeh",
  "tahajjud",
] as const;

type PrayerName = (typeof PRAYERS)[number];

export function SalahTracker() {
  const t = useTranslations("salah");
  const tToday = useTranslations("today");

  const {
    data: completed,
    updateData: setCompleted,
    showPrompt,
    dismissPrompt,
  } = useGuestData<Record<string, boolean>>(getTodayKey("salah"), {});

  const togglePrayer = (prayer: PrayerName) => {
    setCompleted((prev) => ({
      ...prev,
      [prayer]: !prev[prayer],
    }));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tToday("salahTracker")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {PRAYERS.map((prayer) => {
              const isDone = completed[prayer];
              return (
                <button
                  key={prayer}
                  onClick={() => togglePrayer(prayer)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all border",
                    isDone
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-accent border-border",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors",
                      isDone
                        ? "border-primary-foreground bg-primary-foreground/20"
                        : "border-muted-foreground/30",
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
                  <span className="text-xs font-medium">{t(prayer)}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
