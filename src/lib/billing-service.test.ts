import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openPortal, startCheckout, type CustomerDb } from "./billing-service";

function fakes(opts: { customerId?: string | null; had?: boolean; active?: boolean; url?: string | null } = {}) {
  const stripe = {
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: opts.url === undefined ? "https://stripe.test/c" : opts.url }),
      },
    },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://stripe.test/p" }) } },
  };
  let customerId = opts.customerId ?? null;
  const db: CustomerDb = {
    findCustomerId: vi.fn(async () => customerId),
    saveCustomer: vi.fn(async (_u, id) => {
      customerId = id;
    }),
    hasHadSubscription: vi.fn(async () => opts.had ?? false),
    hasActiveSubscription: vi.fn(async () => opts.active ?? false),
  };
  return { stripe, db, deps: { stripe: stripe as unknown as Stripe, db, appUrl: "https://app.test" } };
}

beforeEach(() => {
  process.env.STRIPE_PRICE_MONTHLY = "price_m";
  process.env.STRIPE_PRICE_YEARLY = "price_y";
});

describe("startCheckout", () => {
  it("creates customer with idempotency key, then a trial checkout session", async () => {
    const { stripe, db, deps } = fakes();
    expect(await startCheckout("u1", "month", deps)).toEqual({ url: "https://stripe.test/c" });
    expect(stripe.customers.create).toHaveBeenCalledWith(
      { metadata: { app: "ramadan-planner", user_id: "u1" } },
      { idempotencyKey: "cust-u1" },
    );
    expect(db.saveCustomer).toHaveBeenCalledWith("u1", "cus_new");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_new",
      client_reference_id: "u1",
      line_items: [{ price: "price_m", quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: {
        metadata: { app: "ramadan-planner", user_id: "u1" },
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      },
      success_url: "https://app.test/settings?billing=success",
      cancel_url: "https://app.test/pricing?canceled=1",
    });
  });

  it("reuses an existing customer and uses the yearly price", async () => {
    const { stripe, deps } = fakes({ customerId: "cus_old" });
    await startCheckout("u1", "year", deps);
    expect(stripe.customers.create).not.toHaveBeenCalled();
    const arg = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(arg.customer).toBe("cus_old");
    expect(arg.line_items[0].price).toBe("price_y");
    expect(arg).not.toHaveProperty("customer_email");
  });

  it("omits trial fields for returning users", async () => {
    const { stripe, deps } = fakes({ had: true, customerId: "cus_old" });
    await startCheckout("u1", "month", deps);
    const sd = stripe.checkout.sessions.create.mock.calls[0][0].subscription_data;
    expect(sd).toEqual({ metadata: { app: "ramadan-planner", user_id: "u1" } });
  });

  it("returns already_subscribed without any Stripe call", async () => {
    const { stripe, deps } = fakes({ active: true });
    expect(await startCheckout("u1", "month", deps)).toEqual({ error: "already_subscribed" });
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("strips a trailing slash from appUrl", async () => {
    const { stripe, deps } = fakes({ customerId: "c" });
    await startCheckout("u1", "month", { ...deps, appUrl: "https://app.test/" });
    const arg = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(arg.success_url).toBe("https://app.test/settings?billing=success");
    expect(arg.cancel_url).toBe("https://app.test/pricing?canceled=1");
  });

  it("throws when Stripe returns no url", async () => {
    const { deps } = fakes({ customerId: "c", url: null });
    await expect(startCheckout("u1", "month", deps)).rejects.toThrow();
  });
});

describe("openPortal", () => {
  it("returns no_customer when none exists", async () => {
    const { stripe, deps } = fakes();
    expect(await openPortal("u1", deps)).toEqual({ error: "no_customer" });
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a portal session with return_url", async () => {
    const { stripe, deps } = fakes({ customerId: "cus_old" });
    expect(await openPortal("u1", deps)).toEqual({ url: "https://stripe.test/p" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_old",
      return_url: "https://app.test/settings",
    });
  });
});
