// GET (public) / POST (admin) /api/announcements. Logic in src/server/api/announcements.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleAnnouncementsGet, handleAnnouncementsPost } from "@/server/api/announcements";

export const Route = createFileRoute("/api/announcements/")({
  server: {
    handlers: {
      GET: () => handleAnnouncementsGet(),
      POST: ({ request }) => handleAnnouncementsPost(request),
    },
  },
});
