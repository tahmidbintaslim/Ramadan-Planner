"use client";

import { useState, useCallback, useSyncExternalStore, useEffect, type ReactNode } from "react";
import { useMatches } from "@tanstack/react-router";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { useTheme } from "next-themes";
import {
  Accessibility,
  Sun,
  Moon,
  Monitor,
  Clock,
  Plus,
  Minus,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatLocalizedNumber } from "@/lib/locale-number";

// Accessibility settings (font size, theme incl. Auto). Inside the app shell they live in the More sheet (mobile)
// and behind a side-nav footer button (desktop); on pages without the shell (landing, auth) the floating button
// opens the same controls. The stored font size is applied on every page by <AccessibilitySidebar /> in the root.

export const FONT_SIZE_KEY = "ramadan-planner-font-size";
const FONT_SIZE_EVENT = "rp:font-size";
export const DEFAULT_FONT_SIZE = 100;
export const MIN_FONT_SIZE = 80;
export const MAX_FONT_SIZE = 150;
const STEP = 5;

function applyFontSize(size: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${size}%`;
  document.body.style.fontSize = "1rem";
}

/** Used when localStorage is unavailable: the size then lasts for this page session. */
let memoryFontSize: number | null = null;

/** The stored font size (percent), or the default when missing or out of range. */
export function readFontSize(): number {
  if (memoryFontSize !== null) return memoryFontSize;
  try {
    const size = Number.parseInt(localStorage.getItem(FONT_SIZE_KEY) ?? "", 10);
    return size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE ? size : DEFAULT_FONT_SIZE;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

function subscribeFontSize(onChange: () => void) {
  window.addEventListener(FONT_SIZE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FONT_SIZE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Font size shared by every control instance (localStorage + an in-page event). */
export function useFontSize(): [number, (size: number) => void] {
  const size = useSyncExternalStore(subscribeFontSize, readFontSize, () => DEFAULT_FONT_SIZE);
  const set = useCallback((next: number) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, next));
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(clamped));
      memoryFontSize = null;
    } catch {
      // Storage unavailable: readFontSize falls back to this, so every control stays in step.
      memoryFontSize = clamped;
    }
    window.dispatchEvent(new Event(FONT_SIZE_EVENT));
  }, []);
  return [size, set];
}

/** Maps fontSize percentage 80–150 to a Tailwind fractional width class */
function fontBarWidthClass(size: number): string {
  const pct = ((size - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE)) * 100;
  if (pct <= 0) return "w-0";
  if (pct <= 15) return "w-[14%]";
  if (pct <= 30) return "w-[28%]";
  if (pct <= 45) return "w-[42%]";
  if (pct <= 55) return "w-[57%]";
  if (pct <= 70) return "w-[71%]";
  if (pct <= 85) return "w-[85%]";
  return "w-full";
}

/** The controls themselves: font size and theme (Light / Night / System / Auto). */
export function AccessibilityControls({ className }: { className?: string }) {
  const t = useTranslations("accessibility");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useFontSize();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: t("light") },
    { value: "dark" as const, icon: Moon, label: t("dark") },
    { value: "system" as const, icon: Monitor, label: t("system") },
    { value: "auto" as const, icon: Clock, label: t("auto") },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("fontSize")}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFontSize(fontSize - STEP)}
            disabled={fontSize <= MIN_FONT_SIZE}
            aria-label={t("decrease")}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1 text-center">
            <span className="text-sm font-medium tabular-nums" aria-live="polite">
              {formatLocalizedNumber(fontSize, locale)}%
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setFontSize(fontSize + STEP)}
            disabled={fontSize >= MAX_FONT_SIZE}
            aria-label={t("increase")}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setFontSize(DEFAULT_FONT_SIZE)} aria-label={t("reset")}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full bg-primary rounded-full transition-all", fontBarWidthClass(fontSize))} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("theme")}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={mounted ? theme === option.value : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-colors",
                mounted && theme === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-label={option.label}
            >
              <option.icon className="h-4 w-4" />
              <span className="text-[10px] leading-tight">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A dialog with the controls, opened by `trigger` (the desktop side-nav footer button). */
export function AccessibilityDialog({ trigger }: { trigger: ReactNode }) {
  const t = useTranslations("accessibility");
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("title")}</DialogDescription>
        </DialogHeader>
        <AccessibilityControls />
      </DialogContent>
    </Dialog>
  );
}

/** Applies the stored font size on every page and whenever a control changes it. */
function FontSizeSync() {
  const [fontSize] = useFontSize();
  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);
  return null;
}

/** Root-level: font size sync everywhere, plus the floating trigger on pages outside the app shell. */
export function AccessibilitySidebar() {
  const inAppShell = useMatches({ select: (matches) => matches.some((m) => m.routeId.startsWith("/_app")) });
  return (
    <>
      <FontSizeSync />
      {inAppShell ? null : <FloatingAccessibility />}
    </>
  );
}

function FloatingAccessibility() {
  const t = useTranslations("accessibility");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center justify-center lg:bottom-6 lg:right-6 border shadow-lg transition-all duration-200",
          "h-12 w-12 rounded-full",
          "bg-primary text-primary-foreground hover:scale-110",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "rotate-45",
        )}
        aria-label={t("title")}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Accessibility className="h-5 w-5" />}
      </button>

      <div
        className={cn(
          "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 w-[min(92vw,18rem)] md:w-72 lg:bottom-20 lg:right-6",
          "rounded-xl border bg-card shadow-2xl transition-all duration-200 origin-bottom-right",
          isOpen ? "scale-100 opacity-100 pointer-events-auto" : "scale-75 opacity-0 pointer-events-none",
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
          <AccessibilityControls />
        </div>
      </div>

      {isOpen && <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  );
}
