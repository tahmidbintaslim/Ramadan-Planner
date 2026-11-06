import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  buildCheckoutParams,
  handleDonationCheckout,
  handleDonationPortal,
  handleDonationSummary,
  type CheckoutDeps,
  type PortalDeps,
} from "./donations";

// Stripe is never called: createSession / retrieveSession / createPortalSession are mocks. Fake values only.
const ORIGIN = "https://app.example";
const PRODUCT = "prod_fake_donation";

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_unit_tests");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const post = (path: string, body: unknown, ip = "203.0.113.1") =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

function checkoutDeps(over: Partial<CheckoutDeps> = {}): CheckoutDeps & { createSession: ReturnType<typeof vi.fn> } {
  return {
    createSession: vi.fn(async () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_abc" })),
    getClerkUserId: async () => null,
    productId: () => PRODUCT,
    limiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    ...over,
  } as CheckoutDeps & { createSession: ReturnType<typeof vi.fn> };
}

describe("buildCheckoutParams", () => {
  const ctx = { baseUrl: `${ORIGIN}/`, productId: PRODUCT, clerkUserId: null };

  it("one-time: payment mode, donate button, inline price_data on the product, metadata on the PaymentIntent", () => {
    const p = buildCheckoutParams({ amount: 12.5, currency: "gbp", frequency: "once", locale: "en" }, ctx);
    expect(p.mode).toBe("payment");
    expect(p.submit_type).toBe("donate");
    expect(p.line_items).toEqual([{ quantity: 1, price_data: { currency: "gbp", product: PRODUCT, unit_amount: 1250 } }]);
    expect(p.metadata).toEqual({ app: "ramadan-planner", frequency: "once" });
    expect(p.payment_intent_data?.metadata).toEqual(p.metadata);
    expect(p.subscription_data).toBeUndefined();
    expect(p.success_url).toBe(`${ORIGIN}/support?donation=success`);
    expect(p.cancel_url).toBe(`${ORIGIN}/support?donation=cancel`);
    expect(p.locale).toBe("en");
  });

  it("monthly: subscription mode with a monthly recurring price and the session id on the success URL", () => {
    const p = buildCheckoutParams({ amount: 10, currency: "usd", frequency: "monthly", locale: "bn" }, ctx);
    expect(p.mode).toBe("subscription");
    expect(p.submit_type).toBeUndefined();
    expect(p.line_items?.[0].price_data).toEqual({ currency: "usd", product: PRODUCT, unit_amount: 1000, recurring: { interval: "month" } });
    expect(p.subscription_data?.metadata).toEqual({ app: "ramadan-planner", frequency: "monthly" });
    expect(p.success_url).toBe(`${ORIGIN}/support?donation=success&monthly=1&session_id={CHECKOUT_SESSION_ID}`);
    // Stripe Checkout has no Bengali locale.
    expect(p.locale).toBe("auto");
  });

  it("puts the Clerk user id in metadata only, and nothing else about the user", () => {
    const p = buildCheckoutParams({ amount: 5, currency: "eur", frequency: "once", locale: "bn" }, { ...ctx, clerkUserId: "user_2abc" });
    expect(p.metadata).toEqual({ app: "ramadan-planner", frequency: "once", clerk_user_id: "user_2abc" });
    expect(p.customer_email).toBeUndefined();
    expect(p.customer).toBeUndefined();
    expect(p.client_reference_id).toBeUndefined();
  });
});

describe("POST /api/donations/checkout", () => {
  it("creates a session for a guest and returns its URL", async () => {
    const deps = checkoutDeps();
    const res = await handleDonationCheckout(post("/api/donations/checkout", { amount: 25, currency: "usd", frequency: "once", locale: "en" }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_abc" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    const params = deps.createSession.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params.line_items?.[0].price_data?.unit_amount).toBe(2500);
    expect(params.metadata?.clerk_user_id).toBeUndefined();
  });

  it("attaches the signed-in Clerk user id to metadata", async () => {
    const deps = checkoutDeps({ getClerkUserId: async () => "user_signed_in" });
    await handleDonationCheckout(post("/api/donations/checkout", { amount: 5, currency: "gbp", frequency: "monthly" }), deps);
    expect(deps.createSession.mock.calls[0][0].metadata.clerk_user_id).toBe("user_signed_in");
  });

  it.each([
    [{ amount: 0.5, currency: "usd", frequency: "once" }, "amount_min"],
    [{ amount: 20_000, currency: "usd", frequency: "once" }, "amount_max"],
    [{ amount: 500, currency: "bdt", frequency: "monthly" }, "monthly_unsupported"],
    [{ amount: 5, currency: "jpy", frequency: "once" }, "invalid_request"],
    ["not json", "invalid_request"],
  ])("rejects %j with 400 (%s) and never calls Stripe", async (body, issue) => {
    const deps = checkoutDeps();
    const res = await handleDonationCheckout(post("/api/donations/checkout", body), deps);
    expect(res.status).toBe(400);
    expect((await res.json()).issue).toBe(issue);
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("rate-limits per IP", async () => {
    const deps = checkoutDeps({ limiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
    const body = { amount: 5, currency: "usd", frequency: "once" };
    expect((await handleDonationCheckout(post("/api/donations/checkout", body, "198.51.100.9"), deps)).status).toBe(200);
    expect((await handleDonationCheckout(post("/api/donations/checkout", body, "198.51.100.9"), deps)).status).toBe(200);
    const limited = await handleDonationCheckout(post("/api/donations/checkout", body, "198.51.100.9"), deps);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("600");
    expect((await handleDonationCheckout(post("/api/donations/checkout", body, "198.51.100.10"), deps)).status).toBe(200);
    expect(deps.createSession).toHaveBeenCalledTimes(3);
  });

  it("answers 503 when Stripe is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const deps = checkoutDeps();
    const res = await handleDonationCheckout(post("/api/donations/checkout", { amount: 5, currency: "usd", frequency: "once" }), deps);
    expect(res.status).toBe(503);
    expect((await handleDonationCheckout(post("/api/donations/checkout", { amount: 5, currency: "usd", frequency: "once" }), checkoutDeps({ productId: () => "" }))).status).toBe(503);
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("hides Stripe error text behind a fixed 500", async () => {
    const deps = checkoutDeps({ createSession: vi.fn(async () => { throw new Error("No such product: prod_secret_detail"); }) });
    const res = await handleDonationCheckout(post("/api/donations/checkout", { amount: 5, currency: "usd", frequency: "once" }), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("prod_secret_detail");
  });
});

describe("GET /api/donations/summary", () => {
  it("returns the anonymous summary with a 5 minute CDN cache", async () => {
    const summary = { months: [{ month: "2026-11", currency: "usd" as const, grossMinor: 2500, refundedMinor: 0, payments: 1 }], donorCount: 1, generatedAt: "2026-11-06T00:00:00.000Z" };
    const res = await handleDonationSummary({ load: async () => summary });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("answers a fixed 500 when the database is unavailable", async () => {
    const res = await handleDonationSummary({ load: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5"); } });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("10.0.0.5");
  });
});

describe("POST /api/donations/portal", () => {
  const SID = "cs_test_a1B2c3D4e5F6g7H8";
  function portalDeps(session: Partial<Stripe.Checkout.Session> | Error): PortalDeps & { createPortalSession: ReturnType<typeof vi.fn> } {
    return {
      retrieveSession: vi.fn(async () => {
        if (session instanceof Error) throw session;
        return { mode: "subscription", customer: "cus_1", metadata: { app: "ramadan-planner" }, ...session } as Stripe.Checkout.Session;
      }),
      createPortalSession: vi.fn(async () => ({ url: "https://billing.stripe.com/p/session/test_x" })),
      limiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    } as PortalDeps & { createPortalSession: ReturnType<typeof vi.fn> };
  }

  it("opens the portal for this app's subscription checkout, returning to /support", async () => {
    const deps = portalDeps({});
    const res = await handleDonationPortal(post("/api/donations/portal", { sessionId: SID }), deps);
    expect(await res.json()).toEqual({ ok: true, url: "https://billing.stripe.com/p/session/test_x" });
    expect(deps.createPortalSession).toHaveBeenCalledWith({ customer: "cus_1", return_url: `${ORIGIN}/support` });
  });

  it.each([
    ["a one-time checkout", { mode: "payment" as const }],
    ["another app's checkout", { metadata: { app: "other" } }],
    ["a session without a customer", { customer: null }],
  ])("refuses %s with 404", async (_n, over) => {
    const deps = portalDeps(over);
    expect((await handleDonationPortal(post("/api/donations/portal", { sessionId: SID }), deps)).status).toBe(404);
    expect(deps.createPortalSession).not.toHaveBeenCalled();
  });

  it("maps an unknown session to 404 and rejects malformed ids with 400", async () => {
    const notFound = Object.assign(new Error("No such checkout.session"), { type: "StripeInvalidRequestError" });
    expect((await handleDonationPortal(post("/api/donations/portal", { sessionId: SID }), portalDeps(notFound))).status).toBe(404);
    for (const sessionId of ["", "cus_123", "cs_test_../../x", 42]) {
      expect((await handleDonationPortal(post("/api/donations/portal", { sessionId }), portalDeps({}))).status).toBe(400);
    }
  });
});
