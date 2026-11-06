// GET /api/donations/summary (public, anonymous, cached 5 minutes). Logic in src/server/api/donations.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleDonationSummary } from "@/server/api/donations";

export const Route = createFileRoute("/api/donations/summary")({
  server: { handlers: { GET: () => handleDonationSummary() } },
});
