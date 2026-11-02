// GET /api/quran. Logic in src/server/api/quran.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleQuran } from "@/server/api/quran";

export const Route = createFileRoute("/api/quran")({
  server: { handlers: { GET: ({ request }) => handleQuran(request) } },
});
