import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { applyDonationEvent, type DonationDb, type DonationRow, type LedgerDeps } from "./donations-ledger";

/** In-memory ledger with the same unique-event-id rule as the table. */
function memoryDb(): DonationDb & { rows: DonationRow[] } {
  const rows: DonationRow[] = [];
  return {
    rows,
    async insert(row) {
      if (rows.some((r) => r.stripeEventId === row.stripeEventId)) return false;
      rows.push(row);
      return true;
    },
    async findPayment(id) {
      const r = rows.find((x) => x.stripeObjectId === id && x.status === "succeeded");
      return r ? { currency: r.currency, frequency: r.frequency, stripeSubscriptionId: r.stripeSubscriptionId } : null;
    },
  };
}

const deps = (db = memoryDb(), pi: string | null = "pi_from_api"): LedgerDeps & { db: ReturnType<typeof memoryDb> } => ({
  db,
  paymentIntentForInvoice: vi.fn(async () => pi),
});

const ev = (id: string, type: string, object: object, previous?: object) =>
  ({ id, type, created: 1, data: { object, ...(previous ? { previous_attributes: previous } : {}) } }) as unknown as Stripe.Event;

const session = (over: object = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  amount_total: 2500,
  currency: "usd",
  payment_intent: "pi_1",
  metadata: { app: "ramadan-planner", frequency: "once" },
  customer_details: { name: "Should Not Be Stored", email: "donor@example.com", address: { country: "GB", city: "London" } },
  ...over,
});

const invoice = (over: object = {}) => ({
  id: "in_1",
  object: "invoice",
  amount_paid: 1000,
  currency: "gbp",
  customer_address: { country: "US", line1: "1 Main St" },
  customer_email: "donor@example.com",
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { app: "ramadan-planner" } } },
  ...over,
});

describe("applyDonationEvent", () => {
  it("records a paid one-time checkout with no PII beyond the country", async () => {
    const d = deps();
    expect(await applyDonationEvent(ev("evt_1", "checkout.session.completed", session()), d)).toBe("recorded");
    expect(d.db.rows).toEqual([
      {
        stripeEventId: "evt_1",
        stripeObjectId: "pi_1",
        stripeSubscriptionId: null,
        amountMinor: 2500,
        currency: "usd",
        frequency: "once",
        status: "succeeded",
        country: "GB",
      },
    ]);
    expect(JSON.stringify(d.db.rows)).not.toMatch(/donor@example\.com|Should Not Be Stored|London/);
  });

  it("is idempotent: the same event id twice records one row", async () => {
    const d = deps();
    const e = ev("evt_dup", "checkout.session.completed", session());
    expect(await applyDonationEvent(e, d)).toBe("recorded");
    expect(await applyDonationEvent(e, d)).toBe("duplicate");
    expect(d.db.rows).toHaveLength(1);
  });

  it("records async_payment_succeeded the same way", async () => {
    const d = deps();
    expect(await applyDonationEvent(ev("evt_a", "checkout.session.async_payment_succeeded", session()), d)).toBe("recorded");
  });

  it.each([
    ["another app", { metadata: { app: "scopelock" } }],
    ["no metadata", { metadata: null }],
    ["unpaid", { payment_status: "unpaid" }],
    ["subscription checkout (counted from invoice.paid)", { mode: "subscription" }],
    ["unsupported currency", { currency: "jpy" }],
    ["zero amount", { amount_total: 0 }],
  ])("ignores a checkout session: %s", async (_name, over) => {
    const d = deps();
    expect(await applyDonationEvent(ev("evt_x", "checkout.session.completed", session(over)), d)).toBe("ignored");
    expect(d.db.rows).toEqual([]);
  });

  it("records each paid monthly invoice with its subscription id, fetching the PaymentIntent when absent", async () => {
    const d = deps();
    expect(await applyDonationEvent(ev("evt_inv", "invoice.paid", invoice()), d)).toBe("recorded");
    expect(d.paymentIntentForInvoice).toHaveBeenCalledWith("in_1");
    expect(d.db.rows[0]).toMatchObject({
      stripeObjectId: "pi_from_api",
      stripeSubscriptionId: "sub_1",
      amountMinor: 1000,
      currency: "gbp",
      frequency: "monthly",
      status: "succeeded",
      country: "US",
    });
  });

  it("uses the invoice's own payments list when the payload has it", async () => {
    const d = deps();
    const inv = invoice({ payments: { data: [{ payment: { type: "payment_intent", payment_intent: "pi_inline" } }] } });
    await applyDonationEvent(ev("evt_inv2", "invoice.paid", inv), d);
    expect(d.paymentIntentForInvoice).not.toHaveBeenCalled();
    expect(d.db.rows[0].stripeObjectId).toBe("pi_inline");
  });

  it("ignores invoices of other apps and zero-amount invoices", async () => {
    const d = deps();
    const other = invoice({ parent: { type: "subscription_details", subscription_details: { subscription: "sub_x", metadata: { app: "other" } } } });
    expect(await applyDonationEvent(ev("e1", "invoice.paid", other), d)).toBe("ignored");
    expect(await applyDonationEvent(ev("e2", "invoice.paid", invoice({ amount_paid: 0 })), d)).toBe("ignored");
    expect(await applyDonationEvent(ev("e3", "invoice.paid", invoice({ parent: null })), d)).toBe("ignored");
  });

  it("records only the newly refunded part of a known payment", async () => {
    const d = deps();
    await applyDonationEvent(ev("evt_pay", "checkout.session.completed", session()), d);
    const charge = (refunded: number) => ({ id: "ch_1", object: "charge", amount: 2500, amount_refunded: refunded, payment_intent: "pi_1" });
    expect(await applyDonationEvent(ev("evt_r1", "charge.refunded", charge(1000), { amount_refunded: 0 }), d)).toBe("recorded");
    expect(await applyDonationEvent(ev("evt_r2", "charge.refunded", charge(2500), { amount_refunded: 1000 }), d)).toBe("recorded");
    const refunds = d.db.rows.filter((r) => r.status === "refunded");
    expect(refunds.map((r) => r.amountMinor)).toEqual([1000, 1500]);
    expect(refunds[0]).toMatchObject({ stripeObjectId: "pi_1", currency: "usd", frequency: "once", country: null });
  });

  it("ignores refunds of payments that are not in the ledger", async () => {
    const d = deps();
    const charge = { id: "ch_9", object: "charge", amount: 500, amount_refunded: 500, payment_intent: "pi_unknown" };
    expect(await applyDonationEvent(ev("evt_r", "charge.refunded", charge), d)).toBe("ignored");
  });

  it("ignores unrelated event types", async () => {
    expect(await applyDonationEvent(ev("e", "customer.created", {}), deps())).toBe("ignored");
  });

  it("propagates a database failure so the webhook answers 5xx and Stripe retries", async () => {
    const d = deps();
    d.db.insert = async () => {
      throw new Error("db down");
    };
    await expect(applyDonationEvent(ev("evt_f", "checkout.session.completed", session()), d)).rejects.toThrow("db down");
  });
});
