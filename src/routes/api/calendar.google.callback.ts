// GET /api/calendar/google/callback. Logic in src/server/api/google-calendar.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleCallback } from "@/server/api/google-calendar";

export const Route = createFileRoute("/api/calendar/google/callback")({
  server: { handlers: { GET: ({ request }) => handleGoogleCallback(request) } },
});
