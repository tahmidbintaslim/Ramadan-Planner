import { useEffect, useState, useTransition } from "react";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { useAuth } from "@/components/providers/auth-provider";
import { getDailyLogAction, saveDailyLogAction } from "@/actions/planner";

export const CHECKLIST_ITEMS = [
  "morningDhikr",
  "eveningDhikr",
  "istighfar",
  "charity",
  "goodDeeds",
  "durud",
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number];

export interface DailyChecklistState {
  checked: Record<string, boolean>;
  toggle: (item: ChecklistKey) => void;
  isPending: boolean;
  showPrompt: boolean;
  dismissPrompt: () => void;
}

/**
 * Today's checklist: guest local storage (rp_checklist_<date>) or the signed-in daily log. Shared by the Home
 * plan preview and the full checklist card, so both show (and toggle) the same state.
 */
export function useDailyChecklist(day: number): DailyChecklistState {
  const { isGuest, loading } = useAuth();
  const [isPending, startTransition] = useTransition();

  const {
    data: guestChecked,
    updateData: setGuestChecked,
    showPrompt,
    dismissPrompt,
  } = useGuestData<Record<string, boolean>>(getTodayKey("checklist"), {});

  const [serverChecked, setServerChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (loading || isGuest) return;

    startTransition(async () => {
      const res = await getDailyLogAction(day);
      if (res.ok && res.data) {
        const next: Record<string, boolean> = {};
        for (const key of res.data.checklist) {
          next[key] = true;
        }
        setServerChecked(next);
      }
    });
  }, [day, isGuest, loading]);

  const checked = isGuest ? guestChecked : serverChecked;

  const toggle = (item: ChecklistKey) => {
    if (isGuest) {
      setGuestChecked((prev) => ({
        ...prev,
        [item]: !prev[item],
      }));
      return;
    }

    const next = { ...serverChecked, [item]: !serverChecked[item] };
    setServerChecked(next);

    // Keeps every checked key, including the Quran/hadith tracker markers stored in the same list.
    const selected = Object.entries(next)
      .filter(([, value]) => value)
      .map(([key]) => key);

    startTransition(async () => {
      await saveDailyLogAction({ day, checklist: selected });
    });
  };

  return { checked, toggle, isPending, showPrompt, dismissPrompt };
}
