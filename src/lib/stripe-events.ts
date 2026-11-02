import type Stripe from "stripe";
import { isAllowedPrice } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  userId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  eventCreated: number;
};

export interface BillingDb {
  /** Inserts the event id; false if it was already recorded. */
  recordEvent(id: string, type: string): Promise<boolean>;
  /** Removes a recorded event id so a failed delivery can be retried. */
  forgetEvent(id: string): Promise<void>;
  userIdForCustomer(customerId: string): Promise<string | null>;
  linkCustomer(userId: string, customerId: string): Promise<void>;
  upsertSubscription(row: SubscriptionRow): Promise<void>;
  getEventCreated(subscriptionId: string): Promise<number | null>;
  markCanceledForUser(userId: string): Promise<void>;
}

export type StripeEventDeps = {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  db: BillingDb;
};

export type ApplyResult = "applied" | "duplicate" | "ignored";

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : (v?.id ?? null));

/**
 * Applies a verified Stripe event. The event id is recorded FIRST (so concurrent
 * redeliveries are deduped), and un-recorded via forgetEvent if processing throws,
 * so Stripe's retry is processed instead of being lost as a duplicate.
 */
export async function applyStripeEvent(event: Stripe.Event, deps: StripeEventDeps): Promise<ApplyResult> {
  if (!(await deps.db.recordEvent(event.id, event.type))) return "duplicate";
  try {
    return await processEvent(event, deps);
  } catch (err) {
    await deps.db.forgetEvent(event.id);
    throw err;
  }
}

async function processEvent(event: Stripe.Event, { db, retrieveSubscription }: StripeEventDeps): Promise<ApplyResult> {
  // Payload subscription data is never trusted: re-fetch from Stripe by id.
  const sync = async (subscriptionId: string | null): Promise<ApplyResult> => {
    if (!subscriptionId) return "ignored";
    const sub = await retrieveSubscription(subscriptionId);
    const item = sub.items.data[0];
    const priceId = item?.price.id ?? "";
    if (!isAllowedPrice(priceId)) return "ignored";
    const customerId = idOf(sub.customer);
    const userId = customerId && (await db.userIdForCustomer(customerId));
    if (!userId) return "ignored";
    const stored = await db.getEventCreated(sub.id);
    if (stored !== null && event.created < stored) return "ignored";
    await db.upsertSubscription({
      id: sub.id,
      userId,
      status: sub.status,
      priceId,
      currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      eventCreated: event.created,
    });
    return "applied";
  };

  const cancelForCustomer = async (customerId: string | null): Promise<ApplyResult> => {
    const userId = customerId && (await db.userIdForCustomer(customerId));
    if (!userId) return "ignored";
    await db.markCanceledForUser(userId);
    return "applied";
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = idOf(session.customer);
      const subscriptionId = idOf(session.subscription);
      if (!subscriptionId) return "ignored";
      if (session.client_reference_id && customerId) await db.linkCustomer(session.client_reference_id, customerId);
      return sync(subscriptionId);
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
      if (charge.amount_refunded < charge.amount) return "ignored";
      return cancelForCustomer(idOf(charge.customer));
    }
    case "customer.deleted":
      return cancelForCustomer(event.data.object.id);
    default:
      return "ignored";
  }
}

/** Prisma-backed BillingDb. Prisma is imported lazily so this module loads without DATABASE_URL. */
export const prismaBillingDb: BillingDb = {
  async recordEvent(id, type) {
    const { prisma } = await import("@/lib/prisma");
    const { count } = await prisma.stripeEvent.createMany({ data: [{ id, type }], skipDuplicates: true });
    return count === 1;
  },
  async forgetEvent(id) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.stripeEvent.deleteMany({ where: { id } });
  },
  async userIdForCustomer(stripeCustomerId) {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.billingCustomer.findUnique({ where: { stripeCustomerId }, select: { userId: true } });
    return row?.userId ?? null;
  },
  async linkCustomer(userId, stripeCustomerId) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.billingCustomer.upsert({
      where: { userId },
      create: { userId, stripeCustomerId },
      update: { stripeCustomerId },
    });
  },
  async upsertSubscription({ eventCreated, ...row }) {
    const { prisma } = await import("@/lib/prisma");
    const data = { ...row, eventCreated: BigInt(eventCreated) };
    await prisma.subscription.upsert({ where: { id: row.id }, create: data, update: data });
  },
  async getEventCreated(id) {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.subscription.findUnique({ where: { id }, select: { eventCreated: true } });
    return row ? Number(row.eventCreated) : null;
  },
  async markCanceledForUser(userId) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.subscription.updateMany({ where: { userId }, data: { status: "canceled" } });
  },
};
