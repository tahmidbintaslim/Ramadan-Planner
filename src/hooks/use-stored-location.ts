import { useMemo, useSyncExternalStore } from "react";
import { LOCATION_STORAGE_KEY, parseStoredLocation, subscribeStoredLocation, type StoredLocation } from "@/lib/user-location";

function readRaw(): string | null {
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The location chosen on this device (null on the server and before mount), kept in step with every save. */
export function useStoredLocation(): StoredLocation | null {
  const raw = useSyncExternalStore(subscribeStoredLocation, readRaw, () => null);
  return useMemo(() => parseStoredLocation(raw), [raw]);
}
