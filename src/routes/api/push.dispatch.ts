// GET (Vercel Cron / GitHub Actions: Bearer CRON_SECRET) and POST (x-cron-secret or Bearer PUSH_DISPATCH_SECRET,
// falling back to CRON_SECRET) /api/push/dispatch. Secret-authenticated, so exempt from CSRF in src/start.ts.
// Logic in src/server/api/push-dispatch.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handlePushDispatchGet, handlePushDispatchPost } from "@/server/api/push-dispatch";

export const Route = createFileRoute("/api/push/dispatch")({
  server: {
    handlers: {
      GET: ({ request }) => handlePushDispatchGet(request),
      POST: ({ request }) => handlePushDispatchPost(request),
    },
  },
});
