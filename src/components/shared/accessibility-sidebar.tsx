"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Accessibility,
  Sun,
  Moon,
  Monitor,
  Plus,
  Minus,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLocalizedNumber } from "@/lib/locale-number";

const FONT_SIZE_KEY = "ramadan-planner-font-size";
const DEFAULT_FONT_SIZE = 100;
const MIN_FONT_SIZE = 80;
const MAX_FONT_SIZE = 150;
const STEP = 10;

function getInitialFontSize(): number {
  if (typeof window === "undefined") return DEFAULT_FONT_SIZE;
  const saved = localStorage.getItem(FONT_SIZE_KEY);
  if (saved) {
    const size = parseInt(saved, 10);
    if (size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE) {
      document.documentElement.style.fontSize = `${size}%`;
      return size;
    }
  }
  return DEFAULT_FONT_SIZE;
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

export function AccessibilitySidebar() {
  const t = useTranslations("accessibility");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(getInitialFontSize);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const updateFontSize = useCallback((newSize: number) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newSize));
    setFontSize(clamped);
    document.documentElement.style.fontSize = `${clamped}%`;
    localStorage.setItem(FONT_SIZE_KEY, String(clamped));
  }, []);

  const increaseFontSize = () => updateFontSize(fontSize + STEP);
  const decreaseFontSize = () => updateFontSize(fontSize - STEP);
  const resetFontSize = () => updateFontSize(DEFAULT_FONT_SIZE);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: t("light") },
    { value: "dark" as const, icon: Moon, label: t("dark") },
    { value: "system" as const, icon: Monitor, label: t("system") },
  ];

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-45 md:bottom-6 right-6   z-50 flex items-center justify-center",
          "h-12 w-12 rounded-full shadow-lg transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-110",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "rotate-45",
        )}
        aria-label={t("title")}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Accessibility className="h-5 w-5" />
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-40 md:bottom-20 right-4 z-50 w-64",
          "rounded-xl border bg-card shadow-2xl transition-all duration-200 origin-bottom-right",
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-75 opacity-0 pointer-events-none",
        )}
      >
        <div className="p-4 space-y-4">
          {/* Header */}
          <h3 className="text-sm font-semibold text-foreground">
            {t("title")}
          </h3>

          {/* Font Size Control */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("fontSize")}
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={decreaseFontSize}
                disabled={fontSize <= MIN_FONT_SIZE}
                aria-label={t("decrease")}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>

              <div className="flex-1 text-center">
                <span className="text-sm font-medium tabular-nums">
                  {formatLocalizedNumber(fontSize, locale)}%
                </span>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={increaseFontSize}
                disabled={fontSize >= MAX_FONT_SIZE}
                aria-label={t("increase")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={resetFontSize}
                aria-label={t("reset")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Font size preview bar */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full bg-primary rounded-full transition-all",
                  fontBarWidthClass(fontSize),
                )}
              />
            </div>
          </div>

          {/* Theme Control */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("theme")}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs transition-colors",
                    mounted && theme === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  aria-label={option.label}
                >
                  <option.icon className="h-4 w-4" />
                  <span className="text-[10px] leading-tight">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
