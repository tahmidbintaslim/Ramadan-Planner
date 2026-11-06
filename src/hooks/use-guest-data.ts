"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { pruneLocalHistory } from "@/lib/local-history";
import { localDayKey, migrateUtcDayKey } from "@/lib/local-day";
import { signedInFromCookie } from "@/lib/user-location";

function loadFromStorage<T>(key: string, defaultValue: T, migrate?: (key: string) => void): T {
    if (typeof window === "undefined") return defaultValue;
    try {
        // Today's entry may still sit under the old UTC-date key (one-time copy, see migrateUtcDayKey).
        migrateUtcDayKey(`rp_${key}`);
        migrate?.(key);
        const stored = localStorage.getItem(`rp_${key}`);
        if (stored) {
            return JSON.parse(stored) as T;
        }
    } catch {
        // Invalid stored data
    }
    return defaultValue;
}

const subscribeNoop = () => () => {};

export interface GuestDataOptions {
    /** Runs before a key is read (a one-time move of older data to this key). */
    migrate?: (key: string) => void;
}

interface Slot<T> {
    /** The storage key `data` belongs to: data is only ever written back under this key. */
    key: string;
    data: T;
    /** Changed by updateData since it was loaded (only then is it written). */
    dirty: boolean;
}

/**
 * Local-first persistence for guests: the value under localStorage `rp_<key>`.
 *
 * - `key` may change (a day-scoped key from useLocalDayKey changes at local midnight): the hook then loads the new
 *   key's value. The data and the key it was loaded from move together, so the old day's data is never written
 *   under the new day's key.
 * - Nothing is written until updateData is called, and never for a signed-in user (see the write effect).
 *
 * @param key - Storage key, usually date-scoped (e.g. "salah_2026-03-01" from useLocalDayKey("salah"))
 * @param defaultValue - Default value when no stored data exists
 */
export function useGuestData<T>(key: string, defaultValue: T, options: GuestDataOptions = {}) {
    const { migrate } = options;
    const { isGuest, loading } = useAuth();
    const [slot, setSlot] = useState<Slot<T>>(() => ({ key, data: loadFromStorage(key, defaultValue, migrate), dirty: false }));
    const [showPrompt, setShowPrompt] = useState(false);

    // The key changed (e.g. midnight): switch to the new key's stored value during this render.
    let current = slot;
    if (slot.key !== key) {
        current = { key, data: loadFromStorage(key, defaultValue, migrate), dirty: false };
        setSlot(current);
    }

    // Write the user's changes, under the key they were made for. Signed-in users keep nothing on the device. While
    // the auth client loads, Clerk's session cookie (known before clerk-js) decides: a session means wait (the write
    // is dropped once the user is known to be signed in); none means a guest, written at once (also when clerk-js
    // never loads, e.g. offline).
    useEffect(() => {
        if (!slot.dirty || !isGuest || typeof window === "undefined") return;
        if (loading && signedInFromCookie(document.cookie)) return;
        try {
            localStorage.setItem(`rp_${slot.key}`, JSON.stringify(slot.data));
            pruneLocalHistory(`rp_${slot.key.replace(/_\d{4}-\d{2}-\d{2}$/, "")}`, 7);
        } catch {
            // Storage full or unavailable
        }
    }, [slot, isGuest, loading]);

    const updateData = useCallback((updater: T | ((prev: T) => T)) => {
        setSlot((prev) => ({
            key: prev.key,
            data: typeof updater === "function" ? (updater as (p: T) => T)(prev.data) : updater,
            dirty: true,
        }));
        // Guest mode supports local-first persistence without signup prompts.
        setShowPrompt(false);
    }, []);

    const dismissPrompt = useCallback(() => {
        setShowPrompt(false);
    }, []);

    // The server cannot read localStorage: the server render and the hydrating render show the default value, then
    // the stored data (avoids a hydration mismatch, React #418, once a guest has saved anything).
    const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

    return { data: mounted ? current.data : defaultValue, updateData, showPrompt, dismissPrompt };
}

/**
 * Today's day-scoped key, read once (not live). Components should prefer useLocalDayKey, which follows midnight.
 */
export function getTodayKey(prefix: string): string {
    return localDayKey(prefix);
}
