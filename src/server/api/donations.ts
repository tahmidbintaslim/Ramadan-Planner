// Server-only handlers for the card-donation routes:
//   POST /api/donations/checkout  create a Stripe Checkout Session (guests welcome; CSRF-checked in src/start.ts)
//   GET  /api/donations/summary   public, anonymous ledger totals (cached 5 minutes)
//   POST /api/donations/portal    Stripe customer portal for a monthly donor (CSRF-checked)
// Dependencies are injectable so Vitest runs these without Stripe, Clerk or a database.
import "@tanstack/react-start/server-only";
import type Stripe from "stripe";
import { z } from "zod";
import {
  checkoutRequestSchema,
  toMinorUnits,
  type CheckoutRequest,
  type DonationCurrency,
  type DonationSummary,
  type DonationSummaryRow,
} from "@/lib/donations";
import { clientIp, createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { getStripe, stripeEnv } from "@/lib/stripe";
import { ttlCache } from "@/lib/ttl-cache";
import { DONATION_APP } from "@/server/donations-ledger";
import { appBaseUrl, guarded, json } from "./http";

const noStore = { "Cache-Control": "no-store" };
const UNAVAILABLE = "Card donations are not available right now";

// ── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutDeps {
  /** Creates the session in Stripe; returns its hosted URL. */
  createSession(params: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }>;
  /** Raw Clerk user id of the caller, or null for a guest (or when Clerk is unreachable). */
  getClerkUserId(): Promise<string | null>;
  productId(): string;
  limiter: RateLimiter;
}

/** 10 checkout attempts per IP per 10 minutes, per server instance. */
const checkoutLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

const defaultCheckoutDeps: CheckoutDeps = {
  createSession: (params) => getStripe().checkout.sessions.create(params),
  async getClerkUserId() {
    try {
      const { auth } = await import("@clerk/tanstack-react-start/server");
      return (await auth()).userId ?? null;
    } catch {
      // Donating never depends on Clerk: a guest or a Clerk outage both just mean "no user id".
      return null;
    }
  },
  productId: () => stripeEnv("STRIPE_DONATION_PRODUCT_ID"),
  limiter: checkoutLimiter,
};

/**
 * The Checkout Session parameters for a validated request. Exported for tests. One-time: mode "payment" with
 * submit_type "donate". Monthly: mode "subscription" with a monthly recurring price_data. Both use inline
 * price_data on the donation product, so no Price objects are created. No customer is created for one-time gifts.
 */
export function buildCheckoutParams(
  req: CheckoutRequest,
  { baseUrl, productId, clerkUserId }: { baseUrl: string; productId: string; clerkUserId: string | null },
): Stripe.Checkout.SessionCreateParams {
  const monthly = req.frequency === "monthly";
  const metadata: Record<string, string> = { app: DONATION_APP, frequency: req.frequency };
  if (clerkUserId) metadata.clerk_user_id = clerkUserId;
  const base = baseUrl.replace(/\/+$/, "");
  return {
    mode: monthly ? "subscription" : "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: req.currency,
          product: productId,
          unit_amount: toMinorUnits(req.amount, req.currency),
          ...(monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    // Monthly donors come back with the session id so this browser can open the customer portal later.
    success_url: monthly
      ? `${base}/support?donation=success&monthly=1&session_id={CHECKOUT_SESSION_ID}`
      : `${base}/support?donation=success`,
    cancel_url: `${base}/support?donation=cancel`,
    // Stripe Checkout has no Bengali locale ("bn" is not in its list), so Bengali users get "auto".
    locale: req.locale === "en" ? "en" : "auto",
    metadata,
    ...(monthly
      ? { subscription_data: { metadata } }
      : { submit_type: "donate" as const, payment_intent_data: { metadata } }),
  };
}

export async function handleDonationCheckout(request: Request, deps: CheckoutDeps = defaultCheckoutDeps): Promise<Response> {
  return guarded("api/donations/checkout", async () => {
    if (!deps.limiter.hit(clientIp(request))) {
      return json({ ok: false, error: "Too many attempts, try again in a few minutes" }, { status: 429, headers: { ...noStore, "Retry-After": "600" } });
    }
    const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.code === "custom")?.message ?? "invalid_request";
      return json({ ok: false, error: "Invalid donation", issue }, { status: 400, headers: noStore });
    }
    const productId = deps.productId();
    if (!productId || !stripeEnv("STRIPE_SECRET_KEY")) {
      return json({ ok: false, error: UNAVAILABLE }, { status: 503, headers: noStore });
    }
    const params = buildCheckoutParams(parsed.data, {
      baseUrl: appBaseUrl(request),
      productId,
      clerkUserId: await deps.getClerkUserId(),
    });
    const session = await deps.createSession(params);
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
    return json({ ok: true, url: session.url }, { headers: noStore });
  });
}

// ── Public summary ──────────────────────────────────────────────────────────

export interface SummaryDeps {
  load(): Promise<DonationSummary>;
}

const SUMMARY_TTL_MS = 5 * 60_000;

type RawMonth = { month: string; currency: string; gross: bigint | number; refunded: bigint | number; payments: bigint | number };

async function loadSummaryFromDb(): Promise<DonationSummary> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRaw<RawMonth[]>`
    SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
           currency,
           COALESCE(SUM(amount_minor) FILTER (WHERE status = 'succeeded'), 0)::bigint AS gross,
           COALESCE(SUM(amount_minor) FILTER (WHERE status = 'refunded'), 0)::bigint AS refunded,
           COUNT(*) FILTER (WHERE status = 'succeeded')::bigint AS payments
      FROM public.donations
     WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') - interval '23 months'
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2`;
  const [{ donors }] = await prisma.$queryRaw<{ donors: bigint | number }[]>`
    SELECT COUNT(DISTINCT COALESCE(stripe_subscription_id, stripe_object_id))::bigint AS donors
      FROM public.donations
     WHERE status = 'succeeded'`;
  return {
    months: rows.map(
      (r): DonationSummaryRow => ({
        month: r.month,
        currency: r.currency as DonationCurrency,
        grossMinor: Number(r.gross),
        refundedMinor: Number(r.refunded),
        payments: Number(r.payments),
      }),
    ),
    donorCount: Number(donors),
    generatedAt: new Date().toISOString(),
  };
}

const defaultSummaryDeps: SummaryDeps = { load: () => ttlCache("donations:summary", SUMMARY_TTL_MS, loadSummaryFromDb) };

export async function handleDonationSummary(deps: SummaryDeps = defaultSummaryDeps): Promise<Response> {
  return guarded("api/donations/summary", async () => {
    const summary = await deps.load();
    // Anonymous aggregates only, so the CDN may cache it as long as the server does.
    return json(summary, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=60" } });
  });
}

// ── Customer portal (monthly donors) ────────────────────────────────────────

export interface PortalDeps {
  retrieveSession(id: string): Promise<Pick<Stripe.Checkout.Session, "mode" | "customer" | "metadata">>;
  createPortalSession(params: Stripe.BillingPortal.SessionCreateParams): Promise<{ url: string }>;
  limiter: RateLimiter;
}

const portalLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

const defaultPortalDeps: PortalDeps = {
  retrieveSession: (id) => getStripe().checkout.sessions.retrieve(id),
  createPortalSession: (params) => getStripe().billingPortal.sessions.create(params),
  limiter: portalLimiter,
};

const portalSchema = z.strictObject({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{10,200}$/) });

/**
 * There is no donor account (guests can give), so the only proof of being the donor is the Checkout Session id
 * Stripe put on this browser's success URL: unguessable, and it only ever opens the portal of that session's
 * own customer, and only for this app's subscription checkouts.
 */
export async function handleDonationPortal(request: Request, deps: PortalDeps = defaultPortalDeps): Promise<Response> {
  return guarded("api/donations/portal", async () => {
    if (!deps.limiter.hit(clientIp(request))) {
      return json({ ok: false, error: "Too many attempts, try again in a few minutes" }, { status: 429, headers: { ...noStore, "Retry-After": "600" } });
    }
    const parsed = portalSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, error: "Invalid request" }, { status: 400, headers: noStore });
    if (!stripeEnv("STRIPE_SECRET_KEY")) return json({ ok: false, error: UNAVAILABLE }, { status: 503, headers: noStore });

    let session: Awaited<ReturnType<PortalDeps["retrieveSession"]>>;
    try {
      session = await deps.retrieveSession(parsed.data.sessionId);
    } catch (error) {
      if ((error as { type?: string })?.type === "StripeInvalidRequestError") {
        return json({ ok: false, error: "Not found" }, { status: 404, headers: noStore });
      }
      throw error;
    }
    const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (session.mode !== "subscription" || session.metadata?.app !== DONATION_APP || !customer) {
      return json({ ok: false, error: "Not found" }, { status: 404, headers: noStore });
    }
    const portal = await deps.createPortalSession({ customer, return_url: `${appBaseUrl(request).replace(/\/+$/, "")}/support` });
    return json({ ok: true, url: portal.url }, { headers: noStore });
  });
}
