// GET /api/ramadan-timetable. Logic in src/server/api/ramadan-timetable.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleRamadanTimetable } from "@/server/api/ramadan-timetable";

export const Route = createFileRoute("/api/ramadan-timetable")({
  server: { handlers: { GET: ({ request }) => handleRamadanTimetable(request) } },
});
