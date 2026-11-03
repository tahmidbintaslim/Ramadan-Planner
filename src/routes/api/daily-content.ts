// GET /api/daily-content. Logic in src/server/api/daily-content.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleDailyContent } from "@/server/api/daily-content";

export const Route = createFileRoute("/api/daily-content")({
  server: { handlers: { GET: ({ request }) => handleDailyContent(request) } },
});
