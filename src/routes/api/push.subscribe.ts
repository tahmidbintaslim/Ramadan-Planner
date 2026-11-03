// POST /api/push/subscribe (signed-in; CSRF-checked in src/start.ts). Logic in src/server/api/push-subscribe.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handlePushSubscribe } from "@/server/api/push-subscribe";

export const Route = createFileRoute("/api/push/subscribe")({
  server: { handlers: { POST: ({ request }) => handlePushSubscribe(request) } },
});
