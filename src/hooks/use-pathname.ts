import { useLocation } from "@tanstack/react-router";

/** Current URL path (no search or hash); replacement for next/navigation's usePathname. */
export function usePathname(): string {
  return useLocation({ select: (l) => l.pathname });
}
