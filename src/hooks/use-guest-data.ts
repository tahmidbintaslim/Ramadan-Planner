"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { pruneLocalHistory } from "@/lib/local-history";

function loadFromStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    try {
        const stored = localStorage.getItem(`rp_${key}`);
        if (stored) {
            return JSON.parse(stored) as T;
        }
    } catch {
        // Invalid stored data
    }
    return defaultValue;
}

/**
 * Hook that persists data to localStorage for guest users,
 * and triggers signup prompt on first save interaction.
 *
 * @param key - Storage key (date-scoped, e.g. "salah-2026-03-01")
 * @param defaultValue - Default value when no stored data exists
 */
export function useGuestData<T>(key: string, defaultValue: T) {
    const { isGuest } = useAuth();
    const [data, setData] = useState<T>(() => loadFromStorage(key, defaultValue));
    const [showPrompt, setShowPrompt] = useState(false);
    const [hasInteracted] = useState(false);

    const keyFamily = key.replace(/_\d{4}-\d{2}-\d{2}$/, "");
    const prefixWithRp = `rp_${keyFamily}`;

    // Save to localStorage whenever data changes
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(`rp_${key}`, JSON.stringify(data));
            pruneLocalHistory(prefixWithRp, 7);
        } catch {
            // Storage full or unavailable
        }
    }, [key, data, prefixWithRp]);

    const updateData = useCallback(
        (updater: T | ((prev: T) => T)) => {
            setData(updater);
            // Guest mode now supports local-first persistence without signup prompts.
            if (isGuest && !hasInteracted) setShowPrompt(false);
        },
        [isGuest, hasInteracted],
    );

    const dismissPrompt = useCallback(() => {
        setShowPrompt(false);
    }, []);

    return { data, updateData, showPrompt, dismissPrompt };
}

/**
 * Get today's date key for localStorage scoping
 */
export function getTodayKey(prefix: string): string {
    const today = new Date().toISOString().split("T")[0];
    return `${prefix}_${today}`;
}
