import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { GRANTING_STATUSES } from "@/lib/entitlements";
import { isAllowedPrice } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  userId: string;
  status: string;
  priceId: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  eventCreated: number;
};

/** Database operations available inside one transaction. */
export interface BillingTx {
  /** Inserts the event id; false if it was already recorded. */
  recordEvent(id: string, type: string): Promise<boolean>;
  /** Serializes concurrent events for one subscription until the transaction ends. */
  lockSubscription(subscriptionId: string): Promise<void>;
  userIdForCustomer(customerId: string): Promise<string | null>;
  /** Creates the link if neither the user nor the customer is linked yet; never overwrites or throws on a conflict. */
  linkCustomer(userId: string, customerId: string): Promise<void>;
  /** Deletes the link for this customer; no-op if absent. */
  unlinkCustomer(customerId: string): Promise<void>;
  upsertSubscription(row: SubscriptionRow): Promise<void>;
  getEventCreated(subscriptionId: string): Promise<number | null>;
  /** Sets status canceled on all of the user's subscriptions; eventCreated only ever rises. */
  markCanceledForUser(userId: string, eventCreated: number): Promise<void>;
}

export interface BillingDb {
  /** Runs fn in one transaction: any throw rolls back everything, including the event record. */
  runInTransaction<T>(fn: (tx: BillingTx) => Promise<T>): Promise<T>;
}

export type StripeEventDeps = {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  db: BillingDb;
};

export type ApplyResult = "applied" | "duplicate" | "ignored";

type Step = (tx: BillingTx) => Promise<ApplyResult>;

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : (v?.id ?? null));

const GRANTING = new Set<string>(GRANTING_STATUSES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Applies a verified Stripe event. Any Stripe fetch happens first, outside the transaction
 * (never hold a transaction across a network call). Then the event record and all writes run
 * in ONE transaction, record first: an error or crash rolls back the record so Stripe's retry
 * is processed, and a concurrent delivery of the same id blocks on the unique insert until the
 * first transaction commits ("duplicate") or rolls back (processed).
 */
export async function applyStripeEvent(event: Stripe.Event, deps: StripeEventDeps): Promise<ApplyResult> {
  const step = await prepare(event, deps.retrieveSubscription);
  return deps.db.runInTransaction(async (tx) => {
    if (!(await tx.recordEvent(event.id, event.type))) return "duplicate";
    return step(tx);
  });
}

async function prepare(event: Stripe.Event, retrieveSubscription: StripeEventDeps["retrieveSubscription"]): Promise<Step> {
  const ignored: Step = async () => "ignored";

  // Payload subscription data is never trusted: re-fetch from Stripe by id.
  const sync = async (subscriptionId: string | null, before?: (tx: BillingTx) => Promise<void>): Promise<Step> => {
    if (!subscriptionId) return ignored;
    const sub = await retrieveSubscription(subscriptionId);
    return async (tx) => {
      await tx.lockSubscription(sub.id);
      if (before) await before(tx);
      const item = sub.items.data[0];
      const priceId = item?.price.id ?? "";
      const stored = await tx.getEventCreated(sub.id);
      // A disallowed price may only revoke an existing row, never create or grant.
      if (!isAllowedPrice(priceId) && (stored === null || GRANTING.has(sub.status))) return "ignored";
      const customerId = idOf(sub.customer);
      const userId = customerId && (await tx.userIdForCustomer(customerId));
      if (!userId) return "ignored";
      if (stored !== null && event.created < stored) return "ignored";
      await tx.upsertSubscription({
        id: sub.id,
        userId,
        status: sub.status,
        priceId,
        currentPeriodStart: item?.current_period_start ? new Date(item.current_period_start * 1000) : null,
        currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        eventCreated: event.created,
      });
      return "applied";
    };
  };

  const cancelForCustomer =
    (customerId: string | null): Step =>
    async (tx) => {
      const userId = customerId && (await tx.userIdForCustomer(customerId));
      if (!userId) return "ignored";
      await tx.markCanceledForUser(userId, event.created);
      return "applied";
    };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = idOf(session.customer);
      const ref = session.client_reference_id;
      // A bad reference skips linking; sync then trusts whatever link already exists (or ignores).
      const userId = ref && UUID_RE.test(ref) ? ref : null;
      return sync(
        idOf(session.subscription),
        userId && customerId ? (tx) => tx.linkCustomer(userId, customerId) : undefined,
      );
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return sync(event.data.object.id);
    case "invoice.paid":
    case "invoice.payment_failed":
      return sync(idOf(event.data.object.parent?.subscription_details?.subscription));
    case "charge.refunded": {
      const charge = event.data.object;
      if (charge.amount_refunded < charge.amount) return ignored;
      // Cancels locally and bumps eventCreated so older events can't re-grant. A refund does not
      // cancel the Stripe subscription, so a NEWER subscription event may re-grant; the operator
      // cancels the subscription in Stripe when refunding (sends customer.subscription.deleted).
      return cancelForCustomer(idOf(charge.customer));
    }
    case "customer.deleted": {
      const customerId = event.data.object.id;
      // Unlink so checkout/portal create a fresh customer; subscription rows stay (no second trial).
      return async (tx) => {
        const result = await cancelForCustomer(customerId)(tx);
        await tx.unlinkCustomer(customerId);
        return result;
      };
    }
    default:
      return ignored;
  }
}

function prismaTx(db: Prisma.TransactionClient): BillingTx {
  return {
    async recordEvent(id, type) {
      const { count } = await db.stripeEvent.createMany({ data: [{ id, type }], skipDuplicates: true });
      return count === 1;
    },
    async lockSubscription(subscriptionId) {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subscriptionId}))`;
    },
    async userIdForCustomer(stripeCustomerId) {
      const row = await db.billingCustomer.findUnique({ where: { stripeCustomerId }, select: { userId: true } });
      return row?.userId ?? null;
    },
    async linkCustomer(userId, stripeCustomerId) {
      await db.billingCustomer.createMany({ data: [{ userId, stripeCustomerId }], skipDuplicates: true });
    },
    async unlinkCustomer(stripeCustomerId) {
      await db.billingCustomer.deleteMany({ where: { stripeCustomerId } });
    },
    async upsertSubscription({ eventCreated, ...row }) {
      const data = { ...row, eventCreated: BigInt(eventCreated) };
      await db.subscription.upsert({ where: { id: row.id }, create: data, update: data });
    },
    async getEventCreated(id) {
      const row = await db.subscription.findUnique({ where: { id }, select: { eventCreated: true } });
      return row ? Number(row.eventCreated) : null;
    },
    async markCanceledForUser(userId, eventCreated) {
      await db.$executeRaw`UPDATE public.subscriptions SET status = 'canceled', event_created = GREATEST(event_created, ${BigInt(eventCreated)}), updated_at = now() WHERE user_id = ${userId}::uuid`;
    },
  };
}

/** Prisma-backed BillingDb. Prisma is imported lazily so this module loads without DATABASE_URL. */
export const prismaBillingDb: BillingDb = {
  async runInTransaction(fn) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.$transaction((tx) => fn(prismaTx(tx)));
  },
};
