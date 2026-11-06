// Server-only Stripe helpers: the API client and webhook signature verification. Nothing here is a secret by
// itself; the keys come from the environment (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) and are never logged.
import "@tanstack/react-start/server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

/** Trimmed env value; a stray newline pasted from the dashboard must not break a key. "" when unset. */
export const stripeEnv = (
  name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET" | "STRIPE_DONATION_PRODUCT_ID",
): string => process.env[name]?.trim() ?? "";

/** The shared Stripe client. Throws when STRIPE_SECRET_KEY is unset, so callers answer 503 instead of guessing. */
export function getStripe(): Stripe {
  const key = stripeEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key, { apiVersion: "2026-10-28.endive" }));
}

/**
 * Verifies the `stripe-signature` header against the RAW request body (the exact bytes Stripe signed: never a
 * re-serialised JSON object) and returns the parsed event. Throws on a missing, malformed, stale (default
 * 300 s tolerance) or forged signature. Uses Stripe's static helper, so no API key is needed to verify.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<Stripe.Event> {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("missing stripe-signature header");
  return Stripe.webhooks.constructEventAsync(rawBody, signature, secret);
}
