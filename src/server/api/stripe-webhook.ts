// Server-only handler for POST /api/stripe/webhook. CSRF-exempt (src/start.ts): Stripe calls it cross-site with
// no cookies, and the `stripe-signature` HMAC over the raw body is the authentication.
import "@tanstack/react-start/server-only";
import type Stripe from "stripe";
import { getStripe, stripeEnv, stripeLiveAllowed, verifyStripeWebhook } from "@/lib/stripe";
import { applyDonationEvent, prismaDonationDb, type LedgerDeps } from "@/server/donations-ledger";
import { guarded, json } from "./http";

const noStore = { "Cache-Control": "no-store" };

export interface WebhookDeps {
  secret(): string;
  verify(rawBody: string, signature: string | null, secret: string): Promise<Stripe.Event>;
  ledger: LedgerDeps;
}

async function paymentIntentForInvoice(invoiceId: string): Promise<string | null> {
  const payments = await getStripe().invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 5 });
  const pi = payments.data.find((p) => p.payment?.payment_intent)?.payment.payment_intent;
  return typeof pi === "string" ? pi : (pi?.id ?? null);
}

const defaultDeps: WebhookDeps = {
  secret: () => stripeEnv("STRIPE_WEBHOOK_SECRET"),
  verify: verifyStripeWebhook,
  ledger: { db: prismaDonationDb, paymentIntentForInvoice },
};

export async function handleStripeWebhook(request: Request, deps: WebhookDeps = defaultDeps): Promise<Response> {
  return guarded("api/stripe/webhook", async () => {
    const secret = deps.secret();
    if (!secret) {
      // Misconfiguration: 503 so Stripe keeps retrying until the secret is set.
      console.error("[api/stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
      return json({ ok: false, error: "Webhook not configured" }, { status: 503, headers: noStore });
    }
    // The exact bytes Stripe signed; parsing to JSON first would break the signature.
    const rawBody = await request.text();
    let event: Stripe.Event;
    try {
      event = await deps.verify(rawBody, request.headers.get("stripe-signature"), secret);
    } catch {
      return json({ ok: false, error: "Invalid signature" }, { status: 400, headers: noStore });
    }
    // Test mode only until live payments are allowed: a live event is acknowledged (so Stripe stops retrying) and
    // never written to the ledger.
    if (event.livemode && !stripeLiveAllowed()) {
      console.error("[api/stripe/webhook] ignored a live-mode event: STRIPE_ALLOW_LIVE is not true");
      return json({ ok: true, result: "ignored-live" }, { headers: noStore });
    }
    // A database or Stripe failure throws here and `guarded` answers 500, so Stripe retries the event.
    const result = await applyDonationEvent(event, deps.ledger);
    return json({ ok: true, result }, { headers: noStore });
  });
}
