// POST /api/stripe/webhook (CSRF-exempt in src/start.ts: Stripe-signature authenticated). Logic in src/server/api/stripe-webhook.ts.
import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/server/api/stripe-webhook";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: { handlers: { POST: ({ request }) => handleStripeWebhook(request) } },
});
