// Server-only: the public site origin for canonical/OG URLs. Never returns a secret: only the three public
// site-URL variables are read.
import "@tanstack/react-start/server-only";

/** `SITE_URL`, else `NEXT_PUBLIC_SITE_URL`, else `VERCEL_PROJECT_PRODUCTION_URL` (host only, so https is added). "" when unset. */
export function getSiteUrl(): string {
  const raw = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map((v) => v?.trim())
    .find((v): v is string => !!v);
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}
