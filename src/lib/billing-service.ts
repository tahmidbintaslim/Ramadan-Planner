import type Stripe from "stripe";
import { priceIdForInterval, trialDaysFor, type Interval } from "./stripe";

export interface CustomerDb {
  findCustomerId(userId: string): Promise<string | null>;
  saveCustomer(userId: string, customerId: string): Promise<void>;
  hasHadSubscription(userId: string): Promise<boolean>;
  hasActiveSubscription(userId: string): Promise<boolean>;
}

export interface BillingDeps {
  stripe: Stripe;
  db: CustomerDb;
  appUrl: string;
}

const APP = "ramadan-planner";

/** Prisma-backed CustomerDb. Prisma is imported lazily so this module loads without DATABASE_URL. */
export const prismaCustomerDb: CustomerDb = {
  async findCustomerId(userId) {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.billingCustomer.findUnique({ where: { userId } });
    return row?.stripeCustomerId ?? null;
  },
  async saveCustomer(userId, customerId) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.billingCustomer.upsert({
      where: { userId },
      create: { userId, stripeCustomerId: customerId },
      update: {},
    });
  },
  async hasHadSubscription(userId) {
    const { prisma } = await import("@/lib/prisma");
    return (await prisma.subscription.count({ where: { userId } })) > 0;
  },
  async hasActiveSubscription(userId) {
    const { prisma } = await import("@/lib/prisma");
    return (
      (await prisma.subscription.count({
        where: { userId, status: { in: ["active", "trialing", "past_due"] } },
      })) > 0
    );
  },
};

const baseUrl = (appUrl: string) => appUrl.replace(/\/$/, "");

export async function startCheckout(
  userId: string,
  interval: Interval,
  { stripe, db, appUrl }: BillingDeps,
): Promise<{ url: string } | { error: "already_subscribed" }> {
  if (await db.hasActiveSubscription(userId)) return { error: "already_subscribed" };

  let customer = await db.findCustomerId(userId);
  if (!customer) {
    const created = await stripe.customers.create(
      { metadata: { app: APP, user_id: userId } },
      { idempotencyKey: `cust-${userId}` },
    );
    customer = created.id;
    await db.saveCustomer(userId, customer);
  }

  const trial = trialDaysFor(await db.hasHadSubscription(userId)) > 0;
  const base = baseUrl(appUrl);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceIdForInterval(interval), quantity: 1 }],
    payment_method_collection: "always",
    subscription_data: {
      metadata: { app: APP, user_id: userId },
      ...(trial && {
        trial_period_days: trialDaysFor(false),
        trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
      }),
    },
    success_url: `${base}/settings?billing=success`,
    cancel_url: `${base}/pricing?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout url");
  return { url: session.url };
}

export async function openPortal(
  userId: string,
  { stripe, db, appUrl }: BillingDeps,
): Promise<{ url: string } | { error: "no_customer" }> {
  const customer = await db.findCustomerId(userId);
  if (!customer) return { error: "no_customer" };
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${baseUrl(appUrl)}/settings`,
  });
  return { url: session.url };
}
