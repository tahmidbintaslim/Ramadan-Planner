// POST /api/donations/checkout (guests welcome; CSRF-checked in src/start.ts). Logic in src/server/api/donations.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleDonationCheckout } from "@/server/api/donations";

export const Route = createFileRoute("/api/donations/checkout")({
  server: { handlers: { POST: ({ request }) => handleDonationCheckout(request) } },
});
