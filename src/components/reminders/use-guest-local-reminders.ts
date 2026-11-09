"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fromZonedTime } from "date-fns-tz";
import { useTranslations } from "@/i18n/use-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { useGuestReminderRules } from "@/lib/guest-reminders";
import { applyOffset, baseTimeForRule, type RulePrayerTimes } from "@/lib/reminder-time";
import { useCached } from "@/lib/data-cache";
import { shellUrls } from "@/hooks/use-shell-day";
import { useLocalTodayISO } from "@/hooks/use-local-day";
import { readStoredLocation } from "@/lib/user-location";
import { deviceTimeZone } from "@/components/today/use-home-timings";
import type { ReminderRuleDTO } from "@/actions/planner";

export interface GuestOccurrence {
  rule: ReminderRuleDTO;
  /** When the notification shows (event time + offset). */
  at: Date;
}

/** Today's still-upcoming occurrences of the enabled notification rules, in the place's time zone. */
export function upcomingGuestReminders(
  rules: ReminderRuleDTO[],
  prayerTimes: RulePrayerTimes,
  day: string,
  timeZone: string,
  now: Date,
): GuestOccurrence[] {
  const out: GuestOccurrence[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !rule.channels.includes("push")) continue;
    const base = baseTimeForRule(rule.type, prayerTimes);
    const local = base ? applyOffset(base, rule.offsetMinutes) : null;
    if (!local) continue;
    const at = fromZonedTime(`${day}T${local}:00`, timeZone);
    if (at.getTime() > now.getTime()) out.push({ rule, at });
  }
  return out;
}

const SHOWN_PREFIX = "rp_guest_notified_";
/** Dispatched after asking for notification permission, so open screens re-read it. */
export const PERMISSION_EVENT = "rp-notification-permission";

function subscribePermission(onChange: () => void): () => void {
  window.addEventListener(PERMISSION_EVENT, onChange);
  return () => window.removeEventListener(PERMISSION_EVENT, onChange);
}
const readPermission = (): NotificationPermission | "unsupported" =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/** This browser's notification permission, live after requestNotificationPermission(). Server: "unsupported". */
export function useNotificationPermission(): NotificationPermission | "unsupported" {
  return useSyncExternalStore(subscribePermission, readPermission, () => "unsupported");
}

/** Ask once (a user gesture must call this) and tell open screens. */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  const result = await Notification.requestPermission();
  window.dispatchEvent(new Event(PERMISSION_EVENT));
  return result;
}

async function show(title: string, body: string, tag: string): Promise<void> {
  // One notification per rule and day across tabs and reloads.
  try {
    if (localStorage.getItem(SHOWN_PREFIX + tag)) return;
    localStorage.setItem(SHOWN_PREFIX + tag, "1");
  } catch {
    // Storage off: still show it.
  }
  const options = { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" };
  try {
    const registration = await navigator.serviceWorker?.getRegistration("/");
    if (registration) return await registration.showNotification(title, options);
  } catch {
    // Fall through to the page notification.
  }
  new Notification(title, options);
}

/**
 * Guests (no account, so no server push): while the app is open in this browser and notifications are allowed,
 * today's reminder rules fire as browser notifications. Signed-in users get server push instead (also when the
 * app is closed), which is why the Reminders page asks guests to create an account.
 */
export function useGuestLocalReminders(): void {
  const t = useTranslations("reminders");
  const tSalah = useTranslations("salah");
  const { isGuest, loading } = useAuth();
  const { data: rules } = useGuestReminderRules();
  const today = useLocalTodayISO();
  const permission = useNotificationPermission();
  const active = !loading && isGuest && permission === "granted";
  const { data: timings } = useCached<{ prayerTimes?: RulePrayerTimes }>(active ? shellUrls().today : null);

  useEffect(() => {
    const prayerTimes = timings?.prayerTimes;
    if (!active || !prayerTimes || rules.length === 0) return;
    const timeZone = readStoredLocation()?.tz ?? deviceTimeZone();
    const name = (type: string) =>
      type === "sehri" || type === "iftar" || type === "custom"
        ? t(type)
        : tSalah(type as "fajr" | "dhuhr" | "asr" | "maghrib" | "isha" | "taraweeh" | "tahajjud");
    const timers = upcomingGuestReminders(rules, prayerTimes, today, timeZone, new Date()).map(({ rule, at }) =>
      window.setTimeout(
        () => void show(rule.label || name(rule.type), t("localNotificationBody", { name: name(rule.type) }), `${rule.id}_${today}`),
        at.getTime() - Date.now(),
      ),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [active, rules, timings, today, t, tSalah]);
}
