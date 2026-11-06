// Web Push subscription checks shared by POST /api/push/subscribe and the dispatcher. The server POSTs to
// every stored endpoint, so an endpoint is an outbound request target (SSRF): only the browser vendors' push
// services are accepted, over https, with the default port, and key sizes are capped.

/** Exact push-service hosts. */
const EXACT_HOSTS: ReadonlySet<string> = new Set([
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Opera, Samsung Internet
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari (macOS/iOS 16.4+)
]);

/** Host suffixes: any subdomain of these (but not the bare suffix itself). */
const HOST_SUFFIXES: readonly string[] = [
  ".notify.windows.com", // Edge legacy / Windows (WNS), e.g. wns2-par02p.notify.windows.com
  ".push.apple.com", // Apple regional push hosts
];

export const MAX_P256DH_LENGTH = 200;
export const MAX_AUTH_LENGTH = 100;
export const MAX_ENDPOINT_LENGTH = 2048;
/** Subscriptions kept per user; the oldest are pruned beyond this. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export function isAllowedPushHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** True when `endpoint` is an https URL on an allowed push-service host, default port, no credentials. */
export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port !== "" && url.port !== "443") return false;
  return isAllowedPushHost(url.hostname);
}

/** The p256dh/auth pair when both are non-empty strings within the length caps, else null. */
export function validPushKeys(keys: unknown): { p256dh: string; auth: string } | null {
  if (!keys || typeof keys !== "object") return null;
  const { p256dh, auth } = keys as Record<string, unknown>;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (p256dh.length === 0 || p256dh.length > MAX_P256DH_LENGTH) return null;
  if (auth.length === 0 || auth.length > MAX_AUTH_LENGTH) return null;
  return { p256dh, auth };
}
