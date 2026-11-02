// TEMPORARY (Task 3): remove or promote in Task 8 / billing Part C
// File name escapes the underscore ([_]): a leading "_" would make this a pathless layout route.
// Unauthenticated POST endpoint that proves the server-function-scoped CSRF check does not block webhooks.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/_webhook-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        return Response.json({ bytes: Buffer.byteLength(raw, "utf8") });
      },
    },
  },
});
