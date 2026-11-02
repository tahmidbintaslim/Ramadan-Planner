import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyStripeEvent, type BillingDb, type BillingTx, type SubscriptionRow } from "./stripe-events";

beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_MONTHLY", "price_m");
  vi.stubEnv("STRIPE_PRICE_YEARLY", "price_y");
});
afterEach(() => vi.unstubAllEnvs());

function memDb() {
  const events = new Map<string, string>();
  const customers = new Map<string, string>(); // customerId -> userId
  const subs = new Map<string, SubscriptionRow>();
  const writes: string[] = [];
  const tx: BillingTx = {
    async recordEvent(id, type) {
      if (events.has(id)) return false;
      events.set(id, type);
      return true;
    },
    async userIdForCustomer(c) {
      return customers.get(c) ?? null;
    },
    async linkCustomer(u, c) {
      writes.push("link");
      customers.set(c, u);
    },
    async upsertSubscription(row) {
      writes.push("upsert");
      subs.set(row.id, row);
    },
    async getEventCreated(id) {
      return subs.get(id)?.eventCreated ?? null;
    },
    async markCanceledForUser(u, eventCreated) {
      writes.push("cancel");
      for (const [id, s] of subs) if (s.userId === u) subs.set(id, { ...s, status: "canceled", eventCreated });
    },
  };
  // Serialized transactions with snapshot/rollback, like a DB with a unique event id.
  let queue: Promise<unknown> = Promise.resolve();
  const restore = <K, V>(m: Map<K, V>, snap: Map<K, V>) => {
    m.clear();
    for (const [k, v] of snap) m.set(k, v);
  };
  const db: BillingDb = {
    runInTransaction<T>(fn: (t: BillingTx) => Promise<T>): Promise<T> {
      const run = async () => {
        const snap = [new Map(events), new Map(customers), new Map(subs), [...writes]] as const;
        try {
          return await fn(tx);
        } catch (err) {
          restore(events, snap[0]);
          restore(customers, snap[1]);
          restore(subs, snap[2]);
          writes.splice(0, writes.length, ...snap[3]);
          throw err;
        }
      };
      const result = queue.then(run);
      queue = result.catch(() => {});
      return result;
    },
  };
  return { db, tx, events, customers, subs, writes };
}

function sub(over: Partial<{ id: string; status: string; price: string; customer: unknown; trialEnd: number | null }> = {}) {
  return {
    id: over.id ?? "sub_1",
    object: "subscription",
    status: over.status ?? "active",
    customer: over.customer ?? "cus_1",
    cancel_at_period_end: false,
    trial_end: over.trialEnd ?? null,
    items: { data: [{ price: { id: over.price ?? "price_m" }, current_period_start: 1_797_408_000, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
}

function evt(type: string, object: unknown, over: { id?: string; created?: number } = {}) {
  return { id: over.id ?? "evt_1", type, created: over.created ?? 1000, data: { object } } as unknown as Stripe.Event;
}

function setup(subscription = sub()) {
  const m = memDb();
  m.customers.set("cus_1", "user_1");
  const retrieveSubscription = vi.fn(async (id: string) => ({ ...subscription, id }) as Stripe.Subscription);
  return { ...m, deps: { db: m.db, retrieveSubscription } };
}

describe("applyStripeEvent", () => {
  it("same event id twice is a duplicate with one write", async () => {
    const s = setup();
    const e = evt("customer.subscription.updated", sub({ status: "past_due" }));
    expect(await applyStripeEvent(e, s.deps)).toBe("applied");
    expect(await applyStripeEvent(e, s.deps)).toBe("duplicate");
    expect(s.writes).toEqual(["upsert"]);
  });

  it("uses the re-fetched subscription, not the payload", async () => {
    const s = setup(sub({ status: "active" }));
    await applyStripeEvent(evt("customer.subscription.updated", sub({ status: "past_due" })), s.deps);
    expect(s.deps.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(s.subs.get("sub_1")).toEqual({
      id: "sub_1",
      userId: "user_1",
      status: "active",
      priceId: "price_m",
      currentPeriodStart: new Date(1_797_408_000 * 1000),
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      trialEnd: null,
      cancelAtPeriodEnd: false,
      eventCreated: 1000,
    });
  });

  it("ignores an update older than the stored eventCreated", async () => {
    const s = setup();
    await applyStripeEvent(evt("customer.subscription.updated", sub(), { id: "evt_new", created: 2000 }), s.deps);
    expect(await applyStripeEvent(evt("customer.subscription.updated", sub(), { id: "evt_old", created: 1500 }), s.deps)).toBe(
      "ignored",
    );
    expect(s.subs.get("sub_1")?.eventCreated).toBe(2000);
    expect(s.writes).toEqual(["upsert"]);
  });

  it("ignores a price outside the allowlist and writes no row", async () => {
    const s = setup(sub({ price: "price_evil" }));
    expect(await applyStripeEvent(evt("customer.subscription.created", sub()), s.deps)).toBe("ignored");
    expect(s.subs.size).toBe(0);
  });

  it("ignores a subscription whose customer is not linked to a user", async () => {
    const s = setup(sub({ customer: "cus_unknown" }));
    expect(await applyStripeEvent(evt("customer.subscription.created", sub()), s.deps)).toBe("ignored");
    expect(s.subs.size).toBe(0);
  });

  it("accepts the customer as an expanded object", async () => {
    const s = setup(sub({ customer: { id: "cus_1", object: "customer" } }));
    expect(await applyStripeEvent(evt("customer.subscription.created", sub()), s.deps)).toBe("applied");
    expect(s.subs.get("sub_1")?.userId).toBe("user_1");
  });

  it("stores trialEnd for a trialing subscription", async () => {
    const s = setup(sub({ status: "trialing", trialEnd: 1_700_000_000 }));
    await applyStripeEvent(evt("customer.subscription.created", sub()), s.deps);
    expect(s.subs.get("sub_1")).toMatchObject({ status: "trialing", trialEnd: new Date(1_700_000_000 * 1000) });
  });

  it("checkout.session.completed links client_reference_id then upserts the re-fetched subscription", async () => {
    const s = setup(sub({ customer: "cus_new" }));
    const session = { object: "checkout.session", client_reference_id: "user_9", customer: "cus_new", subscription: "sub_1" };
    expect(await applyStripeEvent(evt("checkout.session.completed", session), s.deps)).toBe("applied");
    expect(s.customers.get("cus_new")).toBe("user_9");
    expect(s.writes).toEqual(["link", "upsert"]);
    expect(s.subs.get("sub_1")?.userId).toBe("user_9");
  });

  it("checkout.session.completed accepts expanded customer and subscription objects", async () => {
    const s = setup(sub({ customer: "cus_new" }));
    const session = {
      object: "checkout.session",
      client_reference_id: "user_9",
      customer: { id: "cus_new" },
      subscription: { id: "sub_1", status: "incomplete" },
    };
    expect(await applyStripeEvent(evt("checkout.session.completed", session), s.deps)).toBe("applied");
    expect(s.deps.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(s.subs.get("sub_1")?.status).toBe("active");
  });

  it("checkout.session.completed without a subscription is ignored", async () => {
    const s = setup();
    const session = { object: "checkout.session", client_reference_id: "user_1", customer: "cus_1", subscription: null };
    expect(await applyStripeEvent(evt("checkout.session.completed", session), s.deps)).toBe("ignored");
    expect(s.writes).toEqual([]);
  });

  it("customer.subscription.deleted stores canceled", async () => {
    const s = setup(sub({ status: "canceled" }));
    expect(await applyStripeEvent(evt("customer.subscription.deleted", sub()), s.deps)).toBe("applied");
    expect(s.subs.get("sub_1")?.status).toBe("canceled");
  });

  it.each(["invoice.paid", "invoice.payment_failed"])("%s re-fetches and upserts the subscription", async (type) => {
    const s = setup(sub({ status: type === "invoice.paid" ? "active" : "past_due" }));
    const invoice = { object: "invoice", parent: { subscription_details: { subscription: "sub_1" } } };
    expect(await applyStripeEvent(evt(type, invoice), s.deps)).toBe("applied");
    expect(s.deps.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(s.subs.get("sub_1")?.status).toBe(type === "invoice.paid" ? "active" : "past_due");
  });

  it("invoice without a subscription is ignored", async () => {
    const s = setup();
    expect(await applyStripeEvent(evt("invoice.paid", { object: "invoice", parent: null }), s.deps)).toBe("ignored");
    expect(s.writes).toEqual([]);
  });

  it("a full refund marks the user's subscription canceled; a partial refund changes nothing", async () => {
    const s = setup();
    await applyStripeEvent(evt("customer.subscription.created", sub(), { id: "evt_c" }), s.deps);
    const charge = (refunded: number) => ({ object: "charge", customer: "cus_1", amount: 500, amount_refunded: refunded });
    expect(await applyStripeEvent(evt("charge.refunded", charge(200), { id: "evt_p" }), s.deps)).toBe("ignored");
    expect(s.subs.get("sub_1")?.status).toBe("active");
    expect(await applyStripeEvent(evt("charge.refunded", charge(500), { id: "evt_f" }), s.deps)).toBe("applied");
    expect(s.subs.get("sub_1")?.status).toBe("canceled");
  });

  it("a refund with the customer as an object maps the user", async () => {
    const s = setup();
    const charge = { object: "charge", customer: { id: "cus_1" }, amount: 500, amount_refunded: 500 };
    expect(await applyStripeEvent(evt("charge.refunded", charge), s.deps)).toBe("applied");
    expect(s.writes).toEqual(["cancel"]);
  });

  it("customer.deleted cancels the user's subscriptions", async () => {
    const s = setup();
    await applyStripeEvent(evt("customer.subscription.created", sub(), { id: "evt_c" }), s.deps);
    expect(await applyStripeEvent(evt("customer.deleted", { id: "cus_1", object: "customer" }, { id: "evt_d" }), s.deps)).toBe(
      "applied",
    );
    expect(s.subs.get("sub_1")?.status).toBe("canceled");
  });

  it("unknown type is ignored", async () => {
    const s = setup();
    expect(await applyStripeEvent(evt("payment_intent.created", {}), s.deps)).toBe("ignored");
    expect(s.writes).toEqual([]);
  });

  it("a failure after recording rolls back and the retry is processed, not treated as a duplicate", async () => {
    const s = setup();
    const upsert = s.tx.upsertSubscription;
    s.tx.upsertSubscription = vi.fn().mockRejectedValueOnce(new Error("db down")).mockImplementation(upsert);
    const e = evt("customer.subscription.updated", sub());
    await expect(applyStripeEvent(e, s.deps)).rejects.toThrow("db down");
    expect(s.events.has("evt_1")).toBe(false);
    expect(await applyStripeEvent(e, s.deps)).toBe("applied");
    expect(s.subs.get("sub_1")?.status).toBe("active");
  });

  it("a concurrent redelivery waits for the first transaction; if that fails, the redelivery is processed", async () => {
    const s = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const upsert = s.tx.upsertSubscription;
    s.tx.upsertSubscription = vi
      .fn()
      .mockImplementationOnce(async () => {
        await gate;
        throw new Error("crash mid-way");
      })
      .mockImplementation(upsert);
    const e = evt("customer.subscription.updated", sub());
    const a = applyStripeEvent(e, s.deps);
    const b = applyStripeEvent(e, s.deps);
    await new Promise((r) => setTimeout(r, 0));
    release();
    await expect(a).rejects.toThrow("crash mid-way");
    expect(await b).toBe("applied");
    expect(s.events.has("evt_1")).toBe(true);
    expect(s.subs.get("sub_1")?.status).toBe("active");
  });

  it("a failed checkout rolls back the customer link too", async () => {
    const s = setup(sub({ customer: "cus_new" }));
    s.tx.upsertSubscription = vi.fn().mockRejectedValue(new Error("db down"));
    const session = { object: "checkout.session", client_reference_id: "user_9", customer: "cus_new", subscription: "sub_1" };
    await expect(applyStripeEvent(evt("checkout.session.completed", session), s.deps)).rejects.toThrow("db down");
    expect(s.customers.has("cus_new")).toBe(false);
    expect(s.events.size).toBe(0);
  });

  it("an older event arriving after a full refund is ignored", async () => {
    const s = setup();
    await applyStripeEvent(evt("customer.subscription.created", sub(), { id: "evt_c", created: 1000 }), s.deps);
    const charge = { object: "charge", customer: "cus_1", amount: 500, amount_refunded: 500 };
    await applyStripeEvent(evt("charge.refunded", charge, { id: "evt_r", created: 3000 }), s.deps);
    expect(s.subs.get("sub_1")).toMatchObject({ status: "canceled", eventCreated: 3000 });
    const invoice = { object: "invoice", parent: { subscription_details: { subscription: "sub_1" } } };
    expect(await applyStripeEvent(evt("invoice.paid", invoice, { id: "evt_old", created: 2000 }), s.deps)).toBe("ignored");
    expect(s.subs.get("sub_1")?.status).toBe("canceled");
  });

  it("an existing row whose subscription moved to a disallowed price is updated for non-granting statuses", async () => {
    const s = setup();
    await applyStripeEvent(evt("customer.subscription.created", sub(), { id: "evt_c" }), s.deps);
    for (const [i, status] of ["past_due", "unpaid", "incomplete_expired", "canceled"].entries()) {
      s.deps.retrieveSubscription.mockResolvedValueOnce(sub({ price: "price_evil", status }));
      const e = evt("customer.subscription.updated", sub(), { id: `evt_${status}`, created: 2000 + i });
      expect(await applyStripeEvent(e, s.deps)).toBe("applied");
      expect(s.subs.get("sub_1")?.status).toBe(status);
    }
  });

  it.each(["active", "trialing"])("an existing row moved to a disallowed price with status %s is left untouched", async (status) => {
    const s = setup();
    await applyStripeEvent(evt("customer.subscription.created", sub(), { id: "evt_c" }), s.deps);
    const before = s.subs.get("sub_1");
    s.deps.retrieveSubscription.mockResolvedValueOnce(sub({ price: "price_evil", status }));
    const e = evt("customer.subscription.updated", sub(), { id: "evt_u", created: 2000 });
    expect(await applyStripeEvent(e, s.deps)).toBe("ignored");
    expect(s.subs.get("sub_1")).toEqual(before);
  });

  it("a failing re-fetch also releases the event for retry", async () => {
    const s = setup();
    s.deps.retrieveSubscription.mockRejectedValueOnce(new Error("stripe down"));
    const e = evt("customer.subscription.updated", sub());
    await expect(applyStripeEvent(e, s.deps)).rejects.toThrow("stripe down");
    expect(await applyStripeEvent(e, s.deps)).toBe("applied");
  });
});
