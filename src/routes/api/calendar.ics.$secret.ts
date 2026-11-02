// GET /api/calendar/ics/$secret (public ICS feed, the secret is the credential). Logic in src/server/api/ics.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleIcs } from "@/server/api/ics";

export const Route = createFileRoute("/api/calendar/ics/$secret")({
  server: { handlers: { GET: ({ request, params }) => handleIcs(request, params.secret) } },
});
