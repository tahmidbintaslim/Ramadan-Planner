import type { ComponentType } from "react";
import { isHiddenPath } from "@/config/features";
import {
  BellIcon,
  CalendarIcon,
  DuaIcon,
  HadithIcon,
  HeartIcon,
  HomeIcon,
  PlanIcon,
  QuranIcon,
  SettingsIcon,
  ShieldIcon,
  TasbihIcon,
  ZakatIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";

// One list of app destinations for the floating bottom nav, the "More" sheet and the desktop side nav.

export type NavIcon = ComponentType<IconProps>;

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
  | "tasbih"
  | "zakat"
  | "hadith"
  | "books"
  | "quiz"
  | "reminders"
  | "support"
  | "settings"
  | "admin";

export interface NavItem {
  href: string;
  icon: NavIcon;
  /** The feature's name (More sheet, page titles). */
  labelKey: NavLabelKey;
  /** The short tab label (bottom nav and the side nav's primary group); defaults to `labelKey`. */
  shortKey?: NavLabelKey;
  /** Only shown to signed-in users. */
  signedInOnly?: boolean;
}

// The Ramadan timetable screen (public, inside the app shell).
export const TIMETABLE_HREF = "/timetable";

/** The four primary destinations (bottom-nav tabs 1–4; the fifth tab opens the More sheet). */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", icon: HomeIcon, labelKey: "today", shortKey: "todayShort" },
  { href: TIMETABLE_HREF, icon: CalendarIcon, labelKey: "timetable", shortKey: "timetableShort" },
  { href: "/plan", icon: PlanIcon, labelKey: "plan", shortKey: "planShort" },
  { href: "/quran", icon: QuranIcon, labelKey: "quran", shortKey: "quranShort" },
];

/**
 * Everything else, listed in the More sheet (mobile) and below the primary items (desktop). Features switched off in
 * src/config/features.ts (hadith, books, quiz) are left out.
 */
export const SECONDARY_NAV: NavItem[] = ([] as NavItem[]).concat([
  { href: "/duas", icon: DuaIcon, labelKey: "duas" },
  { href: "/tasbih", icon: TasbihIcon, labelKey: "tasbih" },
  { href: "/zakat", icon: ZakatIcon, labelKey: "zakat" },
  { href: "/hadith", icon: HadithIcon, labelKey: "hadith" },
  { href: "/reminders", icon: BellIcon, labelKey: "reminders" },
  { href: "/support", icon: HeartIcon, labelKey: "support" },
  { href: "/settings", icon: SettingsIcon, labelKey: "settings" },
  { href: "/admin/announcements", icon: ShieldIcon, labelKey: "admin", signedInOnly: true },
]).filter((item) => !isHiddenPath(item.href));

/** Active when the path is the item's path or below it (hash-only links never match). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
