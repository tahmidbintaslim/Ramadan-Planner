import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link as RouterLink } from "@tanstack/react-router";

// Drop-in replacement for `next/link` at the existing call sites: `href` is a plain string.
// Internal paths render TanStack Router's <Link> (client navigation); external URLs, hash links,
// mailto:/tel: and /api/* (server routes, full page loads) render a plain <a>.
export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children?: ReactNode;
  /** Accepted for next/link compatibility; ignored. */
  prefetch?: boolean | null;
  /** Accepted for next/link compatibility; ignored. */
  scroll?: boolean;
  /** Replace the history entry instead of pushing (internal links only). */
  replace?: boolean;
}

export function isPlainHref(href: string): boolean {
  return (
    href === "" ||
    href.startsWith("#") ||
    href.startsWith("//") ||
    href.startsWith("/api/") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)
  );
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  const { href, replace, children, ...restWithNextProps } = props;
  // next/link-only props are accepted for compatibility and dropped here.
  const { prefetch, scroll, ...rest } = restWithNextProps;
  void prefetch;
  void scroll;
  if (isPlainHref(href)) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }
  // Call sites build dynamic paths (`/quran/${n}`), which the generated route union cannot check.
  const to = href as never;
  return (
    <RouterLink ref={ref} to={to} replace={replace} {...rest}>
      {children}
    </RouterLink>
  );
});

export default Link;
