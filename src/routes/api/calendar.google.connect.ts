// GET /api/calendar/google/connect. Logic in src/server/api/google-calendar.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleConnect } from "@/server/api/google-calendar";

export const Route = createFileRoute("/api/calendar/google/connect")({
  server: { handlers: { GET: ({ request }) => handleGoogleConnect(request) } },
});
