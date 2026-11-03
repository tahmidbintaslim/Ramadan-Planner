import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getTodayKey, useGuestData } from "@/hooks/use-guest-data";
import {
  createReminderRuleAction,
  listReminderRulesAction,
  updateReminderRuleAction,
  type ReminderRuleDTO,
} from "@/actions/planner";
import { FIVE_PRAYERS, type FivePrayer } from "@/components/prayer/use-prayer-phase";

/** A reminder created from the Home bell: the Reminders page's defaults (15 minutes before, push). */
export const DEFAULT_PRAYER_REMINDER = { offsetMinutes: -15, channels: ["push"] as ReminderRuleDTO["channels"] };

export type ReminderChange =
  | { kind: "create"; rule: Omit<ReminderRuleDTO, "id"> }
  | { kind: "update"; rules: ReminderRuleDTO[] }
  | { kind: "none" };

/** Which of the five prayers have at least one enabled rule. */
export function remindersByPrayer(rules: ReminderRuleDTO[]): Record<FivePrayer, boolean> {
  const out = {} as Record<FivePrayer, boolean>;
  for (const p of FIVE_PRAYERS) out[p] = rules.some((r) => r.type === p && r.enabled);
  return out;
}

/**
 * What toggling a prayer's bell does to the rules. Turning on re-enables the prayer's first existing rule (keeping
 * its offset and channels) or creates a default one; turning off disables every rule of that prayer (nothing is
 * deleted, so the user's custom offsets survive).
 */
export function reminderToggleChange(rules: ReminderRuleDTO[], prayer: FivePrayer, enabled: boolean): ReminderChange {
  const own = rules.filter((r) => r.type === prayer);
  if (enabled) {
    if (own.some((r) => r.enabled)) return { kind: "none" };
    if (own.length > 0) return { kind: "update", rules: [{ ...own[0], enabled: true }] };
    return { kind: "create", rule: { type: prayer, label: "", ...DEFAULT_PRAYER_REMINDER, enabled: true } };
  }
  const on = own.filter((r) => r.enabled);
  return on.length > 0 ? { kind: "update", rules: on.map((r) => ({ ...r, enabled: false })) } : { kind: "none" };
}

function applyChange(rules: ReminderRuleDTO[], change: ReminderChange, created?: ReminderRuleDTO): ReminderRuleDTO[] {
  if (change.kind === "update") {
    const byId = new Map(change.rules.map((r) => [r.id, r]));
    return rules.map((r) => byId.get(r.id) ?? r);
  }
  if (change.kind === "create" && created) return [...rules, created];
  return rules;
}

function notifyTrackerUpdate() {
  window.dispatchEvent(new Event("rp-tracker-updated"));
}

/**
 * The prayer list's bells, wired to the same reminder rules as the Reminders page: guest rules in local storage
 * (the page's own key), signed-in rules through the server functions.
 */
export function usePrayerReminders() {
  const { isGuest, loading } = useAuth();
  const { data: guestRules, updateData: updateGuestRules } = useGuestData<ReminderRuleDTO[]>(
    getTodayKey("reminder_rules"),
    [],
  );
  const [serverRules, setServerRules] = useState<ReminderRuleDTO[]>([]);

  useEffect(() => {
    if (loading || isGuest) return;
    let cancelled = false;
    void listReminderRulesAction().then((res) => {
      if (!cancelled && res.ok) setServerRules(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest, loading]);

  const rules = isGuest ? guestRules : serverRules;
  const reminders = useMemo(() => remindersByPrayer(rules), [rules]);

  const toggle = useCallback(
    (prayer: FivePrayer, enabled: boolean) => {
      const change = reminderToggleChange(rules, prayer, enabled);
      if (change.kind === "none") return;

      if (isGuest) {
        const created = change.kind === "create" ? { id: crypto.randomUUID(), ...change.rule } : undefined;
        updateGuestRules((prev) => applyChange(prev, change, created));
        notifyTrackerUpdate();
        return;
      }

      // Optimistic for updates; a create waits for the server id.
      if (change.kind === "update") {
        const previous = serverRules;
        setServerRules((prev) => applyChange(prev, change));
        void Promise.all(change.rules.map((r) => updateReminderRuleAction(r))).then((results) => {
          if (results.some((r) => !r.ok)) setServerRules(previous);
          else notifyTrackerUpdate();
        });
        return;
      }
      void createReminderRuleAction(change.rule).then((res) => {
        if (!res.ok) return;
        setServerRules((prev) => applyChange(prev, change, res.data));
        notifyTrackerUpdate();
      });
    },
    [isGuest, rules, serverRules, updateGuestRules],
  );

  return { reminders, toggle };
}
