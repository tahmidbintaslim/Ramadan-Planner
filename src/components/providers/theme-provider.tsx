"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

// Preferences: light | dark | system | auto. "auto" is stored as a preference only for now: it renders Light until
// the phase-driven Maghrib-to-Fajr switching lands (design system v2, Task 6), which will set the `.dark` class.
export const THEME_PREFERENCES = ["light", "dark", "system", "auto"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const THEME_COLOR = { light: "#F3F8F6", dark: "#0B1F24" } as const;

// Keeps <meta name="theme-color"> in step with the active mode (Light #F3F8F6, Night #0B1F24).
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolvedTheme === "dark" ? THEME_COLOR.dark : THEME_COLOR.light);
  }, [resolvedTheme]);
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
