import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

// Because this file exists, Start no longer adds its default CSRF check, so it is registered here.
// It MUST stay filtered to server functions: unfiltered, it returns 403 to webhooks (e.g. Stripe).
// It runs first, so a cross-site request is rejected before Clerk looks at the session.
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, clerkMiddleware()],
}));
