import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link as RouterLink, defaultParseSearch } from "@tanstack/react-router";

// Drop-in replacement for `next/link` at the existing call sites: `href` is a plain string.
// Internal paths render TanStack Router's <Link> (client navigation); external URLs, hash links,
// mailto:/tel:, relative hrefs and /api/* (server routes, full page loads) render a plain <a>.
// An internal href with `?query` and/or `#hash` is split into TanStack's `to`, `search` and `hash`.
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
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.startsWith("/api/") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)
  );
}

/** Split an internal href into the path, parsed search object and hash that TanStack's Link expects. */
export function splitHref(href: string): { path: string; search?: Record<string, unknown>; hash?: string } {
  const hashAt = href.indexOf("#");
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? undefined : href.slice(hashAt + 1) || undefined;
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt === -1 ? "" : beforeHash.slice(queryAt);
  // The router's own parser, so values round-trip to the same query string (`x=1` stays `x=1`).
  const search = query.length > 1 ? defaultParseSearch(query) : undefined;
  return { path, search, hash };
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
  const { path, search, hash } = splitHref(href);
  return (
    <RouterLink
      ref={ref}
      to={path as never}
      search={search as never}
      hash={hash}
      replace={replace}
      {...rest}
    >
      {children}
    </RouterLink>
  );
});

export default Link;
