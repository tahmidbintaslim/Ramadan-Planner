// POST /api/donations/portal (CSRF-checked in src/start.ts). Logic in src/server/api/donations.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleDonationPortal } from "@/server/api/donations";

export const Route = createFileRoute("/api/donations/portal")({
  server: { handlers: { POST: ({ request }) => handleDonationPortal(request) } },
});
