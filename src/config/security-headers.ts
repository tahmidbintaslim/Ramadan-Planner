// Build-time only (imported by vite.config.ts and tests, never by app code): the security headers for every
// response. vercel.json is the single source of truth, since Vercel applies it at the edge. The Node server
// build (local dev server, e2e) copies the catch-all "/(.*)" entry into Nitro route rules so both platforms
// send identical headers. docs/security.md explains each header and the CSP.
import vercelConfig from "../../vercel.json" with { type: "json" };

interface VercelHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/** Header name -> value from vercel.json's catch-all rule. */
export function securityHeaders(): Record<string, string> {
  const rules = (vercelConfig as { headers?: VercelHeaderRule[] }).headers ?? [];
  const catchAll = rules.find((rule) => rule.source === "/(.*)");
  if (!catchAll) throw new Error('vercel.json has no "/(.*)" headers rule');
  return Object.fromEntries(catchAll.headers.map(({ key, value }) => [key, value]));
}
