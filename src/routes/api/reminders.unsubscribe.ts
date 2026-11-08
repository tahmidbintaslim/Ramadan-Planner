// GET (confirm page) and POST (one-click) /api/reminders/unsubscribe: the signed link in reminder emails.
// HMAC-authenticated, so POST is exempt from CSRF in src/start.ts. Logic in src/server/api/reminder-unsubscribe.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleReminderUnsubscribeGet, handleReminderUnsubscribePost } from "@/server/api/reminder-unsubscribe";

export const Route = createFileRoute("/api/reminders/unsubscribe")({
  server: {
    handlers: {
      GET: ({ request }) => handleReminderUnsubscribeGet(request),
      POST: ({ request }) => handleReminderUnsubscribePost(request),
    },
  },
});
