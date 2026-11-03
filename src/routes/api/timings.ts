// GET /api/timings. Logic in src/server/api/timings.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleTimings } from "@/server/api/timings";

export const Route = createFileRoute("/api/timings")({
  server: { handlers: { GET: ({ request }) => handleTimings(request) } },
});
