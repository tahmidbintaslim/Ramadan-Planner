import type { ComponentType } from "react";
import { BookOpenText, CalendarClock, LayoutGrid, ListChecks, Settings, ShieldCheck, SunMedium } from "lucide-react";
import { isHiddenPath } from "@/config/features";
import { BellIcon, DuaIcon, HadithIcon, HeartIcon, TasbihIcon, ZakatIcon } from "@/components/icons/islamic-icons";

// One list of app destinations for the tab bar, the "More" sheet and the sidebar. UI destinations use lucide
// (stroke 1.75, as in Figma page 10); Islamic tools keep the founder's Hugeicons Islamic set.

export type NavIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;

export type NavLabelKey =
  | "today"
  | "todayShort"
  | "timetable"
  | "timetableShort"
  | "plan"
  | "planShort"
  | "quran"
  | "quranShort"
  | "duas"
  | "duasShort"
  | "tasbih"
  | "tasbihShort"
  | "zakat"
  | "zakatShort"
  | "hadith"
  | "books"
  | "quiz"
  | "reminders"
  | "remindersShort"
  | "support"
  | "settings"
  | "admin";

export interface NavItem {
  href: string;
  icon: NavIcon;
  /** The feature's name (More sheet, page titles). */
  labelKey: NavLabelKey;
  /** The short label (tab bar and sidebar); defaults to `labelKey`. */
  shortKey?: NavLabelKey;
  /** Only shown to signed-in users. */
  /** Shown only to admins (see useIsAdmin). */
  adminOnly?: boolean;
}

/** lucide glyphs are drawn at stroke 1.75 (Figma v4 icons); the Hugeicons set keeps its own 1.5. */
export const LUCIDE_STROKE = 1.75;

// The Ramadan timetable screen (public, inside the app shell).
export const TIMETABLE_HREF = "/timetable";
export const SETTINGS_HREF = "/settings";

/** The four primary destinations (tab bar items 1–4; the fifth tab opens the More sheet). */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", icon: SunMedium, labelKey: "today", shortKey: "todayShort" },
  { href: TIMETABLE_HREF, icon: CalendarClock, labelKey: "timetable", shortKey: "timetableShort" },
  { href: "/plan", icon: ListChecks, labelKey: "plan", shortKey: "planShort" },
  { href: "/quran", icon: BookOpenText, labelKey: "quran", shortKey: "quranShort" },
];

/** The fifth tab (opens the More sheet). */
export const MORE_ICON: NavIcon = LayoutGrid;

/**
 * Everything else, listed in the More sheet (compact, medium) and the sidebar's "More tools" group (regular).
 * Settings sits at the sidebar's foot. Features switched off in src/config/features.ts are left out.
 */
export const SECONDARY_NAV: NavItem[] = ([] as NavItem[]).concat([
  { href: "/duas", icon: DuaIcon, labelKey: "duas", shortKey: "duasShort" },
  { href: "/tasbih", icon: TasbihIcon, labelKey: "tasbih", shortKey: "tasbihShort" },
  { href: "/zakat", icon: ZakatIcon, labelKey: "zakat", shortKey: "zakatShort" },
  { href: "/hadith", icon: HadithIcon, labelKey: "hadith" },
  { href: "/reminders", icon: BellIcon, labelKey: "reminders", shortKey: "remindersShort" },
  { href: "/support", icon: HeartIcon, labelKey: "support" },
  { href: SETTINGS_HREF, icon: Settings, labelKey: "settings" },
  { href: "/admin/announcements", icon: ShieldCheck, labelKey: "admin", adminOnly: true },
]).filter((item) => !isHiddenPath(item.href));

/** Active when the path is the item's path or below it (hash-only links never match). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
