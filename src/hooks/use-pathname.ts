import { useLocation } from "@tanstack/react-router";

/** Current URL path (no search or hash); replacement for the Next.js usePathname hook. */
export function usePathname(): string {
  return useLocation({ select: (l) => l.pathname });
}
