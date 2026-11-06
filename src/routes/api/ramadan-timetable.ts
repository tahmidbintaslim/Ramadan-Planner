// GET /api/ramadan-timetable. Logic in src/server/api/ramadan-timetable.ts; per-IP limit in
// src/server/api/rate-limited.ts.
import { createFileRoute } from "@tanstack/react-router";
import { rateLimitedRamadanTimetable } from "@/server/api/rate-limited";

export const Route = createFileRoute("/api/ramadan-timetable")({
  server: { handlers: { GET: ({ request }) => rateLimitedRamadanTimetable(request) } },
});
