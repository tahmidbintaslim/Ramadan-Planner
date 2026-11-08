// Sign-out on a shared device: the next person must not see this person's notes or get their reminders.
import { CLOCK_FORMAT_KEY } from "@/lib/clock-format";
import { KNOWN_TIMINGS_KEY } from "@/lib/auto-night";
import { LOCAL_DAY_MIGRATION_KEY } from "@/lib/local-day";
import { LOCATION_STORAGE_KEY } from "@/lib/user-location";
import { DATA_CACHE_KEY } from "@/lib/data-cache";
import { WALKTHROUGH_SEEN_KEY } from "@/components/onboarding/walkthrough-state";

/**
 * Device settings that stay (place, clock, cached public data, the seen walkthrough); every other rp_* key is personal
 * and goes.
 */
const KEEP = new Set([
  LOCATION_STORAGE_KEY,
  CLOCK_FORMAT_KEY,
  KNOWN_TIMINGS_KEY,
  LOCAL_DAY_MIGRATION_KEY,
  DATA_CACHE_KEY,
  WALKTHROUGH_SEEN_KEY,
]);

export function personalStorageKeys(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith("rp_") && !KEEP.has(k));
}

export async function clearPersonalDeviceData(): Promise<void> {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? "");
    for (const key of personalStorageKeys(keys)) localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing stored either.
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    // No push on this device.
  }
}
