// GET /api/ramadan. Logic in src/server/api/ramadan.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleRamadan } from "@/server/api/ramadan";

export const Route = createFileRoute("/api/ramadan")({
  server: { handlers: { GET: ({ request }) => handleRamadan(request) } },
});
