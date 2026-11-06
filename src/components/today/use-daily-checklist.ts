import { useState } from "react";
import { useGuestData } from "@/hooks/use-guest-data";
import { useLocalDayKey, useLocalTodayISO } from "@/hooks/use-local-day";
import { useAuth } from "@/components/providers/auth-provider";
import { saveDailyLogAction } from "@/actions/planner";
import { useServerDailyLogField } from "./use-server-daily-log";

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
  /** Toggles are disabled: the signed-in log has not loaded yet, or a save is in flight. */
  isPending: boolean;
  /** The signed-in log could not be loaded (toggles stay disabled). */
  loadFailed: boolean;
  /** The last signed-in save failed and was rolled back. */
  saveFailed: boolean;
  showPrompt: boolean;
  dismissPrompt: () => void;
}

/** The stored checklist as a set of checked keys (includes the Quran/hadith tracker markers kept in the same list). */
const pickChecklist = (log: { checklist: string[] } | null): Record<string, boolean> =>
  Object.fromEntries((log?.checklist ?? []).map((key) => [key, true]));

/**
 * The daily dhikr checklist: guest local storage (rp_checklist_<local date>) or the signed-in daily log, for the
 * checklist card under the Home practices. Signed in, toggles wait for the first load (a toggle before it would
 * save a list without the stored keys) and a failed save rolls back.
 */
export function useDailyChecklist(day: number): DailyChecklistState {
  const { isGuest, loading } = useAuth();
  const todayISO = useLocalTodayISO();

  const {
    data: guestChecked,
    updateData: setGuestChecked,
    showPrompt,
    dismissPrompt,
  } = useGuestData<Record<string, boolean>>(useLocalDayKey("checklist"), {});

  const signedIn = !loading && !isGuest;
  const server = useServerDailyLogField(day, todayISO, signedIn, pickChecklist);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const checked = isGuest ? guestChecked : (server.value ?? {});
  const locked = !isGuest && (server.value === null || saving);

  const toggle = (item: ChecklistKey) => {
    if (isGuest) {
      setGuestChecked((prev) => ({
        ...prev,
        [item]: !prev[item],
      }));
      return;
    }

    if (locked || server.value === null) return;
    const before = server.value;
    const next = { ...before, [item]: !before[item] };
    server.setValue(() => next);
    setSaving(true);

    // Keeps every checked key, including the Quran/hadith tracker markers stored in the same list.
    const selected = Object.entries(next)
      .filter(([, value]) => value)
      .map(([key]) => key);

    const rollback = () => {
      server.setValue(() => before);
      setSaveFailed(true);
    };
    saveDailyLogAction({ day, logDate: todayISO, checklist: selected })
      .then((res) => {
        if (res.ok) {
          server.setValue(() => pickChecklist(res.data));
          setSaveFailed(false);
        } else {
          rollback();
        }
      })
      .catch(rollback)
      .finally(() => setSaving(false));
  };

  return { checked, toggle, isPending: locked, loadFailed: server.loadFailed, saveFailed, showPrompt, dismissPrompt };
}
