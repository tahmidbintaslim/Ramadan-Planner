import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripe, stripeEnv, verifyStripeWebhook } from "./stripe";

// Obvious fake; Stripe's own helper signs the payload locally (no network).
const SECRET = "whsec_fake_test_secret_for_unit_tests";
const payload = JSON.stringify({ id: "evt_test_1", object: "event", type: "checkout.session.completed", data: { object: {} } });
const sign = (body: string, secret = SECRET, timestamp?: number) =>
  Stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp });

afterEach(() => vi.unstubAllEnvs());

describe("verifyStripeWebhook", () => {
  it("accepts a correctly signed raw body and returns the event", async () => {
    const event = await verifyStripeWebhook(payload, sign(payload), SECRET);
    expect(event.id).toBe("evt_test_1");
  });

  it("rejects a body that differs from the signed bytes (e.g. re-serialised JSON)", async () => {
    const reformatted = JSON.stringify(JSON.parse(payload), null, 2);
    await expect(verifyStripeWebhook(reformatted, sign(payload), SECRET)).rejects.toThrow();
  });

  it("rejects a signature made with another secret", async () => {
    await expect(verifyStripeWebhook(payload, sign(payload, "whsec_other_fake"), SECRET)).rejects.toThrow();
  });

  it("rejects a stale signature (older than the 5 minute tolerance)", async () => {
    const old = Math.floor(Date.now() / 1000) - 10 * 60;
    await expect(verifyStripeWebhook(payload, sign(payload, SECRET, old), SECRET)).rejects.toThrow();
  });

  it("rejects a missing header or an unset secret", async () => {
    await expect(verifyStripeWebhook(payload, null, SECRET)).rejects.toThrow(/stripe-signature/);
    await expect(verifyStripeWebhook(payload, sign(payload), "")).rejects.toThrow(/STRIPE_WEBHOOK_SECRET/);
    await expect(verifyStripeWebhook(payload, "t=1,v1=deadbeef", SECRET)).rejects.toThrow();
  });
});

describe("env", () => {
  it("trims values and treats unset as empty", () => {
    vi.stubEnv("STRIPE_DONATION_PRODUCT_ID", " prod_test \n");
    expect(stripeEnv("STRIPE_DONATION_PRODUCT_ID")).toBe("prod_test");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(stripeEnv("STRIPE_WEBHOOK_SECRET")).toBe("");
  });

  it("treats a live secret key as unset unless STRIPE_ALLOW_LIVE is true", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fake_not_a_real_key");
    vi.stubEnv("STRIPE_ALLOW_LIVE", "");
    expect(stripeEnv("STRIPE_SECRET_KEY")).toBe("");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_fake_not_a_real_key");
    expect(stripeEnv("STRIPE_SECRET_KEY")).toBe("");
    vi.stubEnv("STRIPE_ALLOW_LIVE", "true");
    expect(stripeEnv("STRIPE_SECRET_KEY")).toBe("rk_live_fake_not_a_real_key");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_ALLOW_LIVE", "");
    expect(stripeEnv("STRIPE_SECRET_KEY")).toBe("sk_test_fake");
  });

  it("getStripe throws without a secret key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });
});
