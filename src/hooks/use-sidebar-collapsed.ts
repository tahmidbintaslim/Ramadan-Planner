"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "rp_sidebar_collapsed";

export function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try {
            if (typeof window === "undefined") return false;
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw === "1";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const onToggle = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                setCollapsed(raw === "1");
            } catch {
                // ignore
            }
        };

        window.addEventListener("sidebar:toggle", onToggle);
        window.addEventListener("storage", onToggle);
        return () => {
            window.removeEventListener("sidebar:toggle", onToggle);
            window.removeEventListener("storage", onToggle);
        };
    }, []);

    const set = useCallback((value: boolean) => {
        try {
            localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
            window.dispatchEvent(new Event("sidebar:toggle"));
            setCollapsed(value);
        } catch {
            setCollapsed(value);
        }
    }, []);

    const toggle = useCallback(() => set(!collapsed), [collapsed, set]);

    return { collapsed, setCollapsed: set, toggle } as const;
}
