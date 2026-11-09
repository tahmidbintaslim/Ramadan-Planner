// POST /api/events: first-party usage events (CSRF-checked in src/start.ts). Logic in src/server/api/usage-events.ts;
// per-IP limit in src/server/api/rate-limited.ts.
import { createFileRoute } from "@tanstack/react-router";
import { rateLimitedUsageEvent } from "@/server/api/rate-limited";

export const Route = createFileRoute("/api/events")({
  server: { handlers: { POST: ({ request }) => rateLimitedUsageEvent(request) } },
});
