"use client";

import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { CHECKLIST_ITEMS, useDailyChecklist, type DailyChecklistState } from "./use-daily-checklist";
import { TrackerError } from "./tracker-error";

/**
 * The daily dhikr and good-deeds checklist (a different list from today's plan on /plan). Pass `state` to share
 * the parent's copy; otherwise it loads its own.
 */
export function DailyChecklist({ day, state }: { day: number; state?: DailyChecklistState }) {
  if (state) return <DailyChecklistCard state={state} />;
  return <OwnDailyChecklist day={day} />;
}

function OwnDailyChecklist({ day }: { day: number }) {
  const state = useDailyChecklist(day);
  return <DailyChecklistCard state={state} />;
}

function DailyChecklistCard({ state }: { state: DailyChecklistState }) {
  const t = useTranslations("checklist");
  const tToday = useTranslations("today");
  const locale = useLocale();
  const { checked, toggle, isPending, loadFailed, saveFailed, showPrompt, dismissPrompt } = state;
  const completedCount = CHECKLIST_ITEMS.filter((item) => checked[item]).length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="rp-h2 text-rp-ink">{tToday("dhikrChecklist")}</h3>
            <span className="rp-small rounded-rp-full bg-rp-accent-tint px-3 py-1 font-semibold tabular-nums text-rp-accent">
              {formatLocalizedNumber(completedCount, locale)}/{formatLocalizedNumber(CHECKLIST_ITEMS.length, locale)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item}>
                <label
                  htmlFor={item}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-rp-md bg-rp-page px-4 py-2 text-rp-ink has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring"
                >
                  <Checkbox
                    id={item}
                    checked={checked[item] || false}
                    onCheckedChange={() => toggle(item)}
                    disabled={isPending}
                    className="size-5"
                  />
                  <span className={cn("rp-row", checked[item] && "text-rp-muted")}>{t(item)}</span>
                </label>
              </li>
            ))}
          </ul>
          <TrackerError loadFailed={loadFailed} saveFailed={saveFailed} />
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
