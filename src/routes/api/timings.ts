// GET /api/timings. Logic in src/server/api/timings.ts; per-IP limit in src/server/api/rate-limited.ts.
import { createFileRoute } from "@tanstack/react-router";
import { rateLimitedTimings } from "@/server/api/rate-limited";

export const Route = createFileRoute("/api/timings")({
  server: { handlers: { GET: ({ request }) => rateLimitedTimings(request) } },
});
