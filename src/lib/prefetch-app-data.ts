// Warm the shared data cache (src/lib/data-cache.ts) before a screen asks: from the tab routes' loaders (which the
// router also runs on link intent: hover, touchstart, focus) and once at app start, when the browser is idle.
// Fire-and-forget: a loader never waits on these, so navigation is never blocked; the screen picks up the same
// in-flight request. Browser only (the server cannot see the device's stored place).
import { planTimetableUrl, prefetch, screenTimetableUrl, SURAH_LIST_KEY } from "@/lib/data-cache";
import { shellUrls } from "@/hooks/use-shell-day";
import { readStoredLocation } from "@/lib/user-location";

const browser = () => typeof window !== "undefined";

/** Today's and tomorrow's timings and the Ramadan status (the Home, the shell and /plan all read them). */
export function prefetchDay(): void {
  if (!browser()) return;
  const urls = shellUrls();
  prefetch(urls.today);
  prefetch(urls.tomorrow);
  prefetch(urls.ramadan);
}

export function prefetchPlan(): void {
  if (!browser()) return;
  prefetch(shellUrls().ramadan);
  prefetch(planTimetableUrl());
}

export function prefetchTimetable(): void {
  if (browser()) prefetch(screenTimetableUrl());
}

/** App start: everything the main tabs show for the stored place. */
export function prefetchAppData(): void {
  // Only for a known place: a first-run guest is on the way to onboarding and must not fetch the device zone's times.
  if (!browser() || !readStoredLocation()) return;
  prefetchDay();
  prefetchPlan();
  prefetchTimetable();
  prefetch(SURAH_LIST_KEY);
}
