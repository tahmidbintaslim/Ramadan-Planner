// Server-only Stripe helpers: the API client and webhook signature verification. Nothing here is a secret by
// itself; the keys come from the environment (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) and are never logged.
import "@tanstack/react-start/server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

/** Live payments stay off until the founder sets STRIPE_ALLOW_LIVE=true (receiving entity and FD(VA) first). */
export const stripeLiveAllowed = (): boolean => process.env.STRIPE_ALLOW_LIVE?.trim() === "true";

/**
 * Trimmed env value; a stray newline pasted from the dashboard must not break a key. "" when unset. A live
 * secret key (sk_live_ / rk_live_) reads as unset unless live payments are allowed, so a mis-pasted live key
 * makes donations "unavailable" (503) instead of taking real money.
 */
export const stripeEnv = (
  name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET" | "STRIPE_DONATION_PRODUCT_ID",
): string => {
  const value = process.env[name]?.trim() ?? "";
  if (name === "STRIPE_SECRET_KEY" && /^(sk|rk)_live_/.test(value) && !stripeLiveAllowed()) {
    console.error("[stripe] a live secret key is set but STRIPE_ALLOW_LIVE is not true; treating Stripe as off");
    return "";
  }
  return value;
};

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
