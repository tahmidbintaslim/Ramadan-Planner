"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AUTO_NIGHT_SCRIPT, isAutoNight } from "@/lib/auto-night";
import { useKnownTimings } from "@/hooks/use-shell-day";

// Preferences: light | dark | system | auto. "auto" shows Night (the `.dark` class) from Maghrib to Fajr, decided by
// the prayer phase engine with the user's last known timings (fallback 18:00–05:30 local), re-evaluated every
// minute. next-themes maps "auto" to Light; AutoNight overrides it through `forcedTheme` while "auto" is chosen,
// so the stored preference stays "auto" and the Settings/accessibility toggles keep showing it.
export const THEME_PREFERENCES = ["light", "dark", "system", "auto"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

type Mode = "light" | "dark";
const THEME_COLOR = { light: "#F3F8F6", dark: "#0B1F24" } as const;
const MINUTE = 60_000;

// Keeps <meta name="theme-color"> in step with the active mode (Light #F3F8F6, Night #0B1F24).
function ThemeColorSync() {
  const { resolvedTheme, forcedTheme } = useTheme();
  const active = forcedTheme ?? resolvedTheme;
  // Head re-renders on navigation can reset the meta to its Light default, so re-apply after each location change.
  const href = useRouterState({ select: (s) => s.location.href });
  useEffect(() => {
    // Hydration can leave the server's meta next to the one HeadContent renders, so update every copy.
    const content = active === "dark" ? THEME_COLOR.dark : THEME_COLOR.light;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", content));
  }, [active, href]);
  return null;
}

function AutoNight({ onMode }: { onMode: (mode: Mode | undefined) => void }) {
  const { theme } = useTheme();
  const isAuto = theme === "auto";
  const known = useKnownTimings(isAuto);

  useEffect(() => {
    if (!isAuto) {
      onMode(undefined);
      return;
    }
    const evaluate = () => onMode(isAutoNight(new Date(), known) ? "dark" : "light");
    evaluate();
    const id = window.setInterval(evaluate, MINUTE);
    // Timers are throttled in background tabs; catch up as soon as the app is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuto, known, onMode]);

  return null;
}

/** On the client, start from what the pre-hydration script decided, so mounting never flashes Light. */
function initialAutoMode(): Mode | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    if (localStorage.getItem("theme") !== "auto") return undefined;
  } catch {
    return undefined;
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [autoMode, setAutoMode] = useState<Mode | undefined>(initialAutoMode);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      themes={[...THEME_PREFERENCES]}
      value={{ light: "light", dark: "dark", auto: "light" }}
      forcedTheme={autoMode}
      enableSystem
      disableTransitionOnChange
    >
      {/* Runs right after next-themes' own script (which renders "auto" as Light) and applies Night when due. */}
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: AUTO_NIGHT_SCRIPT }} />
      <AutoNight onMode={setAutoMode} />
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
