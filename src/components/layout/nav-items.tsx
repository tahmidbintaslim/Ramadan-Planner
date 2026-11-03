import type { ComponentType } from "react";
import {
  Brain,
  LayoutDashboard,
  Library,
  Scroll,
  Settings,
  ShieldCheck,
  type LucideProps,
} from "lucide-react";
import {
  BellIcon,
  CalendarIcon,
  DuaIcon,
  HomeIcon,
  PlanIcon,
  QuranIcon,
  TasbihIcon,
  ZakatIcon,
  type IconProps,
} from "@/components/icons/islamic-icons";

// One list of app destinations for the floating bottom nav, the "More" sheet and the desktop side nav.

export type NavIcon = ComponentType<IconProps> | ComponentType<LucideProps>;

export type NavLabelKey =
  | "todayShort"
  | "timetable"
  | "plan"
  | "quran"
  | "duas"
  | "tasbih"
  | "zakat"
  | "hadith"
  | "books"
  | "quiz"
  | "reminders"
  | "dashboard"
  | "settings"
  | "admin";

export interface NavItem {
  href: string;
  icon: NavIcon;
  labelKey: NavLabelKey;
  /** Only shown to signed-in users. */
  signedInOnly?: boolean;
}

// The Ramadan timetable screen (public, inside the app shell).
export const TIMETABLE_HREF = "/timetable";

/** The four primary destinations (bottom-nav tabs 1–4; the fifth tab opens the More sheet). */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", icon: HomeIcon, labelKey: "todayShort" },
  { href: TIMETABLE_HREF, icon: CalendarIcon, labelKey: "timetable" },
  { href: "/plan", icon: PlanIcon, labelKey: "plan" },
  { href: "/quran", icon: QuranIcon, labelKey: "quran" },
];

// The support/contribute page (/support) arrives in Task 10; add it here when the route exists.
/** Everything else, listed in the More sheet (mobile) and below the primary items (desktop). */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/duas", icon: DuaIcon, labelKey: "duas" },
  { href: "/tasbih", icon: TasbihIcon, labelKey: "tasbih" },
  { href: "/zakat", icon: ZakatIcon, labelKey: "zakat" },
  { href: "/hadith", icon: Scroll, labelKey: "hadith" },
  { href: "/books", icon: Library, labelKey: "books" },
  { href: "/quiz", icon: Brain, labelKey: "quiz" },
  { href: "/reminders", icon: BellIcon, labelKey: "reminders" },
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/settings", icon: Settings, labelKey: "settings" },
  { href: "/admin/announcements", icon: ShieldCheck, labelKey: "admin", signedInOnly: true },
];

/** Active when the path is the item's path or below it (hash-only links never match). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
