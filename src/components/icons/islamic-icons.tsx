import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "title" | "ref"> {
  /** Pixel size (width and height). Default 24. */
  size?: number | string;
  /** Stroke width. Default 1.6. */
  strokeWidth?: number | string;
  /** Accessible label. When set the icon is exposed as an image, otherwise it is decorative (aria-hidden). */
  title?: string;
}

function createIcon(displayName: string, children: ReactNode) {
  function Icon({ size = 24, strokeWidth = 1.6, title, className, ...rest }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        role={title ? "img" : undefined}
        aria-hidden={title ? false : true}
        focusable="false"
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        {children}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const HomeIcon = createIcon(
  "HomeIcon",
  <>
    <path d="M4 11l8-6.5 8 6.5v9H4z"/><path d="M10 20v-5h4v5"/>
  </>,
);

export const MosqueIcon = createIcon(
  "MosqueIcon",
  <>
    <path d="M3 21h18"/><path d="M5 21v-7h14v7"/><path d="M7 14c0-3 2.3-5 5-6.5 2.7 1.5 5 3.5 5 6.5"/><path d="M12 4v3.5"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/>
  </>,
);

export const CrescentIcon = createIcon(
  "CrescentIcon",
  <>
    <path d="M15 3.6A8.6 8.6 0 1 0 20.4 15 7 7 0 1 1 15 3.6z"/><path d="M18.2 5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>
  </>,
);

export const LanternIcon = createIcon(
  "LanternIcon",
  <>
    <path d="M12 2v2"/><path d="M9 4h6l1 3H8z"/><path d="M8 7c-1.2 3.3-1.2 6.7 0 10h8c1.2-3.3 1.2-6.7 0-10"/><path d="M12 10v4"/><path d="M9 17h6l-1 3h-4z"/>
  </>,
);

export const QuranIcon = createIcon(
  "QuranIcon",
  <>
    <path d="M12 7c-2-1.5-5-2-8-1.5v11c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-11c-3-.5-6 0-8 1.5z"/><path d="M12 7v11"/><path d="M8 21l4-3 4 3"/>
  </>,
);

export const TasbihIcon = createIcon(
  "TasbihIcon",
  <>
    <circle cx="12" cy="4.5" r="1.5"/><circle cx="16.4" cy="6.4" r="1.5"/><circle cx="18.3" cy="10.8" r="1.5"/><circle cx="16.4" cy="15.2" r="1.5"/><circle cx="7.6" cy="6.4" r="1.5"/><circle cx="5.7" cy="10.8" r="1.5"/><circle cx="7.6" cy="15.2" r="1.5"/><path d="M12 17v4M10.5 21h3"/>
  </>,
);

export const DuaIcon = createIcon(
  "DuaIcon",
  <>
    <path d="M7 20v-4.5L4.4 10a1.4 1.4 0 0 1 2.5-1.3L9 12.5V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 20v-4.5l2.6-5.5a1.4 1.4 0 0 0-2.5-1.3L15 12.5V6a1.5 1.5 0 0 0-3 0"/>
  </>,
);

export const CalendarIcon = createIcon(
  "CalendarIcon",
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M14 13.6a2.3 2.3 0 1 0 1.6 3.4 1.9 1.9 0 1 1-1.6-3.4z"/>
  </>,
);

export const ZakatIcon = createIcon(
  "ZakatIcon",
  <>
    <circle cx="14.5" cy="7.5" r="4"/><path d="M14.5 6v3"/><path d="M3 15h3.5l3 2h4.5a1.5 1.5 0 0 1 0 3H9"/><path d="M14.5 17.5l4.2-2.6a1.5 1.5 0 0 1 1.8 2.3L16 21H7l-4-1.8"/>
  </>,
);

export const FajrIcon = createIcon(
  "FajrIcon",
  <>
    <path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 7v3M5.6 10.6l1.8 1.8M18.4 10.6l-1.8 1.8"/><path d="M8 21h8"/>
  </>,
);

export const DhuhrIcon = createIcon(
  "DhuhrIcon",
  <>
    <circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>
  </>,
);

export const AsrIcon = createIcon(
  "AsrIcon",
  <>
    <circle cx="9" cy="9" r="3.2"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.4 1.6A2.8 2.8 0 0 0 8 20z"/>
  </>,
);

export const MaghribIcon = createIcon(
  "MaghribIcon",
  <>
    <path d="M3 17h18"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M12 10V7M9.5 4.5L12 7l2.5-2.5"/><path d="M8 20.5h8"/>
  </>,
);

export const IshaIcon = createIcon(
  "IshaIcon",
  <>
    <path d="M15.5 4A8 8 0 1 0 20 15.5 6.5 6.5 0 1 1 15.5 4z"/><path d="M6 4.5l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z"/>
  </>,
);

export const BellIcon = createIcon(
  "BellIcon",
  <>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/>
  </>,
);

export const PinIcon = createIcon(
  "PinIcon",
  <>
    <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>
  </>,
);

export const HeartIcon = createIcon(
  "HeartIcon",
  <>
    <path d="M12 20s-7.5-4.6-9-9.4A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 3.6C19.5 15.4 12 20 12 20z"/>
  </>,
);

export const ShareIcon = createIcon(
  "ShareIcon",
  <>
    <circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>
  </>,
);

export const CodeIcon = createIcon(
  "CodeIcon",
  <>
    <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>
  </>,
);

export const PlanIcon = createIcon(
  "PlanIcon",
  <>
    <rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8.5l1.3 1.3L11.5 7.6M8 14.5l1.3 1.3 2.2-2.2M14 9h3M14 15h3"/>
  </>,
);

export const MoreIcon = createIcon(
  "MoreIcon",
  <>
    <circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>
  </>,
);

export const CheckIcon = createIcon(
  "CheckIcon",
  <>
    <path d="M6 12.5l4 4 8-9"/>
  </>,
);

export const ChevronRightIcon = createIcon(
  "ChevronRightIcon",
  <>
    <path d="M9 6l6 6-6 6"/>
  </>,
);

export const icons = {
  Home: HomeIcon,
  Mosque: MosqueIcon,
  Crescent: CrescentIcon,
  Lantern: LanternIcon,
  Quran: QuranIcon,
  Tasbih: TasbihIcon,
  Dua: DuaIcon,
  Calendar: CalendarIcon,
  Zakat: ZakatIcon,
  Fajr: FajrIcon,
  Dhuhr: DhuhrIcon,
  Asr: AsrIcon,
  Maghrib: MaghribIcon,
  Isha: IshaIcon,
  Bell: BellIcon,
  Pin: PinIcon,
  Heart: HeartIcon,
  Share: ShareIcon,
  Code: CodeIcon,
  Plan: PlanIcon,
  More: MoreIcon,
  Check: CheckIcon,
  ChevronRight: ChevronRightIcon,
} as const;

export type IconName = keyof typeof icons;
