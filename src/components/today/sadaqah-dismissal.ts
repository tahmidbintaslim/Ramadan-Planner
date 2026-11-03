import { useCallback, useMemo, useSyncExternalStore } from "react";

export const SADAQAH_DISMISSED_KEY = "rp_sadaqah_dismissed_at";
const SADAQAH_DISMISSED_EVENT = "rp:sadaqah-dismissed";

/** The stored dismissal time, or null (missing, invalid or storage unavailable). */
export function parseDismissedAt(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(SADAQAH_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(SADAQAH_DISMISSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SADAQAH_DISMISSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** When the sadaqah card was last dismissed (localStorage, per device), and a dismiss action. */
export function useSadaqahDismissal(): { dismissedAt: Date | null; dismiss: (now?: Date) => void } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const dismissedAt = useMemo(() => parseDismissedAt(raw), [raw]);
  const dismiss = useCallback((now: Date = new Date()) => {
    try {
      localStorage.setItem(SADAQAH_DISMISSED_KEY, now.toISOString());
    } catch {
      // Storage unavailable: the card still hides for this page view (below).
    }
    window.dispatchEvent(new Event(SADAQAH_DISMISSED_EVENT));
  }, []);
  return { dismissedAt, dismiss };
}
