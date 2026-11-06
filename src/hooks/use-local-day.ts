import { useSyncExternalStore } from "react";
import { subscribeClock } from "@/components/prayer/use-prayer-phase";
import { localTodayISO } from "@/lib/local-day";

function subscribe(onChange: () => void) {
  // The shared 30 s clock (refreshed at once when the tab becomes visible), plus a location change in another tab.
  const unsubscribe = subscribeClock(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onChange);
  };
}

const snapshot = () => localTodayISO();

/**
 * Today's local date (YYYY-MM-DD, see local-day.ts), live: it changes at local midnight in a long-lived tab, so
 * day-scoped keys and requests follow the new day. Components re-render only when the date string changes.
 */
export function useLocalTodayISO(): string {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The day-scoped guest storage key for today (`${prefix}_${YYYY-MM-DD}`), live like useLocalTodayISO. */
export function useLocalDayKey(prefix: string): string {
  return `${prefix}_${useLocalTodayISO()}`;
}
