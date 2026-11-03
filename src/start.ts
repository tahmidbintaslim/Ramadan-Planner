import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { errorMaskMiddleware } from "@/server/error-mask-middleware";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

/** Methods that must never change state, so they are not origin-checked on server routes. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * State-changing server routes that are called cross-site WITHOUT cookies and authenticate the request
 * themselves, so an origin check would only break them. Exact paths; anything else is checked.
 */
export const CSRF_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  // Cron/scheduler entry point: shared-secret auth (Bearer CRON_SECRET / x-cron-secret), no session.
  "/api/push/dispatch",
  // Stripe webhook (billing Part C): verified by the `stripe-signature` HMAC, no session.
  "/api/stripe/webhook",
]);

/**
 * Which requests the CSRF middleware checks:
 *  - every server-function call (any method), as Start's own default does;
 *  - every other request whose method is not GET/HEAD/OPTIONS (the mutating /api/* routes such as
 *    POST /api/push/subscribe and POST/PATCH/DELETE /api/announcements), except CSRF_EXEMPT_PATHS.
 * The second rule is deliberately not limited to the "/api/" prefix: the router matches paths
 * case-insensitively, so a prefix test could be bypassed with "/API/...". An exemption is an exact,
 * case-sensitive match (one trailing slash ignored), so any spelling variant is checked (fail closed).
 */
export function needsCsrfCheck(ctx: { request: Request; handlerType: string }): boolean {
  if (ctx.handlerType === "serverFn") return true;
  if (SAFE_METHODS.has(ctx.request.method.toUpperCase())) return false;
  const path = new URL(ctx.request.url).pathname;
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return !CSRF_EXEMPT_PATHS.has(normalized);
}

// Because this file exists, Start no longer adds its default CSRF check, so it is registered here.
// It MUST keep the exemptions above: unfiltered, it returns 403 to webhooks and cron callers.
// It runs first, so a cross-site request is rejected before Clerk looks at the session.
const csrfMiddleware = createCsrfMiddleware({ filter: needsCsrfCheck });

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    // Falls back to the Next.js-era env name so deployments that have not renamed it keep working.
    clerkMiddleware({
      publishableKey:
        process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.VITE_CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    }),
  ],
  // Runs around every server function (outermost): masks unexpected error text, see error-mask-middleware.ts.
  functionMiddleware: [errorMaskMiddleware],
}));
