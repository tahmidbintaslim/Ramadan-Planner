// POST /api/push/subscribe (signed-in; CSRF-checked in src/start.ts). Logic in src/server/api/push-subscribe.ts;
// per-IP limit in src/server/api/rate-limited.ts.
import { createFileRoute } from "@tanstack/react-router";
import { rateLimitedPushSubscribe } from "@/server/api/rate-limited";

export const Route = createFileRoute("/api/push/subscribe")({
  server: { handlers: { POST: ({ request }) => rateLimitedPushSubscribe(request) } },
});
