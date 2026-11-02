// PATCH / DELETE /api/announcements/$id (admin). Logic in src/server/api/announcements.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleAnnouncementDelete, handleAnnouncementPatch } from "@/server/api/announcements";

export const Route = createFileRoute("/api/announcements/$id")({
  server: {
    handlers: {
      PATCH: ({ request, params }) => handleAnnouncementPatch(request, params.id),
      DELETE: ({ request, params }) => handleAnnouncementDelete(request, params.id),
    },
  },
});
