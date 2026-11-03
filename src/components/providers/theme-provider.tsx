"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

// Preferences: light | dark | system | auto. "auto" is stored as a preference only for now: it renders Light until
// the phase-driven Maghrib-to-Fajr switching lands (design system v2, Task 6), which will set the `.dark` class.
export const THEME_PREFERENCES = ["light", "dark", "system", "auto"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const THEME_COLOR = { light: "#F3F8F6", dark: "#0B1F24" } as const;

// Keeps <meta name="theme-color"> in step with the active mode (Light #F3F8F6, Night #0B1F24).
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  // Head re-renders on navigation can reset the meta to its Light default, so re-apply after each location change.
  const href = useRouterState({ select: (s) => s.location.href });
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolvedTheme === "dark" ? THEME_COLOR.dark : THEME_COLOR.light);
  }, [resolvedTheme, href]);
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      themes={[...THEME_PREFERENCES]}
      value={{ light: "light", dark: "dark", auto: "light" }}
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
