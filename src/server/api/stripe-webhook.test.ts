import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyStripeWebhook } from "@/lib/stripe";
import type { DonationDb, DonationRow } from "@/server/donations-ledger";
import { handleStripeWebhook, type WebhookDeps } from "./stripe-webhook";

// Obvious fake secret; payloads are signed locally with Stripe's test helper (no network, no Stripe API).
const SECRET = "whsec_fake_webhook_secret_for_tests";

function memoryDb(): DonationDb & { rows: DonationRow[] } {
  const rows: DonationRow[] = [];
  return {
    rows,
    async insert(row) {
      if (rows.some((r) => r.stripeEventId === row.stripeEventId)) return false;
      rows.push(row);
      return true;
    },
    async findPayment() {
      return null;
    },
  };
}

const completed = (id = "evt_web_1") =>
  JSON.stringify({
    id,
    object: "event",
    type: "checkout.session.completed",
    created: 1,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        amount_total: 500,
        currency: "eur",
        payment_intent: "pi_w",
        metadata: { app: "ramadan-planner" },
        customer_details: { email: "donor@example.com", address: { country: "DE" } },
      },
    },
  });

function setup(secret = SECRET) {
  const db = memoryDb();
  const deps: WebhookDeps = {
    secret: () => secret,
    verify: verifyStripeWebhook,
    ledger: { db, paymentIntentForInvoice: vi.fn(async () => null) },
  };
  const post = (body: string, signature: string | null) =>
    handleStripeWebhook(
      new Request("https://app.example/api/stripe/webhook", {
        method: "POST",
        headers: signature ? { "stripe-signature": signature, "content-type": "application/json" } : {},
        body,
      }),
      deps,
    );
  return { db, post };
}

const sign = (body: string) => Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });

afterEach(() => vi.restoreAllMocks());

describe("POST /api/stripe/webhook", () => {
  it("verifies the signature over the raw body and records the donation", async () => {
    const { db, post } = setup();
    const body = completed();
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "recorded" });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ stripeEventId: "evt_web_1", amountMinor: 500, currency: "eur", country: "DE" });
  });

  it("acknowledges but never records a live-mode event while live payments are off", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_ALLOW_LIVE", "");
    const { db, post } = setup();
    const body = JSON.stringify({ ...JSON.parse(completed("evt_live")), livemode: true });
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "ignored-live" });
    expect(db.rows).toEqual([]);
    vi.unstubAllEnvs();
  });

  it("is idempotent across redeliveries of the same event", async () => {
    const { db, post } = setup();
    const body = completed("evt_again");
    await post(body, sign(body));
    const res = await post(body, sign(body));
    expect(await res.json()).toEqual({ ok: true, result: "duplicate" });
    expect(db.rows).toHaveLength(1);
  });

  it("rejects a forged, missing or mismatched signature with 400 and writes nothing", async () => {
    const { db, post } = setup();
    const body = completed();
    const forged = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_attacker_fake" });
    expect((await post(body, forged)).status).toBe(400);
    expect((await post(body, null)).status).toBe(400);
    expect((await post(completed("evt_other"), sign(body))).status).toBe(400);
    expect(db.rows).toEqual([]);
  });

  it("answers 503 (Stripe retries) while STRIPE_WEBHOOK_SECRET is unset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { post } = setup("");
    const body = completed();
    expect((await post(body, sign(body))).status).toBe(503);
  });

  it("answers 500 on a database failure so Stripe retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, post } = setup();
    db.insert = async () => {
      throw new Error("db down");
    };
    const body = completed();
    expect((await post(body, sign(body))).status).toBe(500);
  });
});
