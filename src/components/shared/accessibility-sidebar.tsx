"use client";

import { useCallback, useSyncExternalStore, useEffect, type ReactNode } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { useTheme } from "next-themes";
import {
  ClockIcon,
  ComputerIcon,
  DhuhrIcon,
  IshaIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
} from "@/components/icons/islamic-icons";
import { ALargeSmall } from "lucide-react";
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

// Text size and theme ("লেখা ও থিম", incl. Auto). Every header (app header, regular toolbar, landing, onboarding,
// auth) opens them from the a-large-small control (TextThemeButton); the More sheet repeats them. There is no
// floating button. The stored font size is applied on every page by <AccessibilitySidebar /> in the root.

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
    { value: "light" as const, icon: DhuhrIcon, label: t("light") },
    { value: "dark" as const, icon: IshaIcon, label: t("dark") },
    { value: "system" as const, icon: ComputerIcon, label: t("system") },
    { value: "auto" as const, icon: ClockIcon, label: t("auto") },
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
            <MinusIcon size={18} />
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
            <PlusIcon size={18} />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setFontSize(DEFAULT_FONT_SIZE)} aria-label={t("reset")}>
            <ResetIcon size={18} />
          </Button>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full bg-primary rounded-full transition-all", fontBarWidthClass(fontSize))} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("theme")}</p>
        <div className="grid grid-cols-2 gap-2">
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
              <option.icon size={18} />
              <span className="rp-caption">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A dialog with the controls, opened by `trigger` (the desktop side-nav footer, the landing header, onboarding). */
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

/**
 * The "লেখা ও থিম" / "Text & Theme" control (v4): lucide a-large-small 24 optically centred in a 44×44 hit box,
 * named by aria-label. Opens the controls in a dialog: app header and toolbar, landing header, onboarding, auth.
 */
export function TextThemeButton({ className, tone = "page" }: { className?: string; tone?: "page" | "live" }) {
  const t = useTranslations("accessibility");
  return (
    <AccessibilityDialog
      trigger={
        <button
          type="button"
          data-testid="text-theme-button"
          aria-label={t("title")}
          title={t("title")}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-rp-full transition-colors outline-none focus-visible:ring-2",
            tone === "live"
              ? "text-rp-on-live hover:bg-white/15 focus-visible:ring-white"
              : "text-rp-ink hover:bg-rp-accent-tint focus-visible:ring-rp-focus",
            className,
          )}
        >
          <ALargeSmall size={24} strokeWidth={1.75} aria-hidden />
        </button>
      }
    />
  );
}

/** Root-level: applies the stored font size on every page. */
export function AccessibilitySidebar() {
  return <FontSizeSync />;
}
