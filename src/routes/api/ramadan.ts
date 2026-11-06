// GET /api/ramadan. Logic in src/server/api/ramadan.ts; per-IP limit in src/server/api/rate-limited.ts.
import { createFileRoute } from "@tanstack/react-router";
import { rateLimitedRamadan } from "@/server/api/rate-limited";

export const Route = createFileRoute("/api/ramadan")({
  server: { handlers: { GET: ({ request }) => rateLimitedRamadan(request) } },
});
