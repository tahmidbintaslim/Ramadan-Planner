import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useGuestReminderRules } from "@/lib/guest-reminders";
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
 * (the stable `rp_reminder_rules` key), signed-in rules through the server functions.
 */
export function usePrayerReminders() {
  const { isGuest, loading } = useAuth();
  const { data: guestRules, updateData: updateGuestRules } = useGuestReminderRules();
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

  // Signed in: a prayer with a request in flight ignores further taps (no duplicate rules from a double tap)
  // and its bell shows the requested state until the server answers.
  const pendingRef = useRef(new Set<FivePrayer>());
  const [optimistic, setOptimistic] = useState<Partial<Record<FivePrayer, boolean>>>({});

  const rules = isGuest ? guestRules : serverRules;
  const reminders = useMemo(
    () => ({ ...remindersByPrayer(rules), ...(isGuest ? {} : optimistic) }),
    [rules, isGuest, optimistic],
  );

  const toggle = useCallback(
    (prayer: FivePrayer, enabled: boolean) => {
      if (isGuest) {
        // Computed from the store's latest value, so quick repeated taps never act on a stale list.
        updateGuestRules((prev) => {
          const change = reminderToggleChange(prev, prayer, enabled);
          const created = change.kind === "create" ? { id: crypto.randomUUID(), ...change.rule } : undefined;
          return applyChange(prev, change, created);
        });
        notifyTrackerUpdate();
        return;
      }

      if (pendingRef.current.has(prayer)) return;
      const change = reminderToggleChange(serverRules, prayer, enabled);
      if (change.kind === "none") return;
      pendingRef.current.add(prayer);
      setOptimistic((prev) => ({ ...prev, [prayer]: enabled }));
      const settle = () => {
        pendingRef.current.delete(prayer);
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[prayer];
          return next;
        });
      };

      const request =
        change.kind === "update"
          ? Promise.all(change.rules.map((r) => updateReminderRuleAction(r))).then((results) => {
              if (results.every((r) => r.ok)) {
                setServerRules((prev) => applyChange(prev, change));
                notifyTrackerUpdate();
              }
            })
          : createReminderRuleAction(change.rule).then((res) => {
              if (!res.ok) return;
              setServerRules((prev) => applyChange(prev, change, res.data));
              notifyTrackerUpdate();
            });
      void request.catch(() => {}).finally(settle);
    },
    [isGuest, serverRules, updateGuestRules],
  );

  return { reminders, toggle };
}
