export const FREE_REMINDER_LIMIT = 3;
export const PAST_DUE_GRACE_DAYS = 5;

/** Subscription statuses that grant Plus outright (past_due only within grace). */
export const GRANTING_STATUSES = ["active", "trialing"] as const;
const isGranting = (status: string) => (GRANTING_STATUSES as readonly string[]).includes(status);

export type Plan = "free" | "plus";
export type PlanSource = "grant" | "subscription" | "none";

export function resolvePlan(input: {
  grant: { expiresAt: Date | null } | null;
  subscription: { status: string; currentPeriodStart: Date | null } | null;
  now: Date;
}): { plan: Plan; source: PlanSource } {
  const { grant, subscription, now } = input;
  if (grant && (grant.expiresAt === null || grant.expiresAt > now)) {
    return { plan: "plus", source: "grant" };
  }
  if (subscription) {
    const { status, currentPeriodStart } = subscription;
    // Grace runs from the period START: Stripe advances the period before a renewal invoice is paid,
    // so the period end of a past_due subscription is the end of the unpaid period.
    const inGrace =
      status === "past_due" &&
      currentPeriodStart !== null &&
      now.getTime() < currentPeriodStart.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000;
    if (isGranting(status) || inGrace) {
      return { plan: "plus", source: "subscription" };
    }
  }
  return { plan: "free", source: "none" };
}

// A user may have several subscription rows (resubscribes); any qualifying row grants plus.
export function resolvePlanFromRows(input: {
  grant: { expiresAt: Date | null } | null;
  subscriptions: Array<{ status: string; currentPeriodStart: Date | null }>;
  now: Date;
}): { plan: Plan; source: PlanSource } {
  const { grant, subscriptions, now } = input;
  const viaGrant = resolvePlan({ grant, subscription: null, now });
  if (viaGrant.plan === "plus") return viaGrant;
  for (const subscription of subscriptions) {
    const r = resolvePlan({ grant: null, subscription, now });
    if (r.plan === "plus") return r;
  }
  return { plan: "free", source: "none" };
}

export async function getEntitlement(userId: string, now: Date = new Date()) {
  // Lazy: prisma.ts throws at import when DATABASE_URL is unset.
  const { prisma } = await import("@/lib/prisma");
  const [grant, subscriptions] = await Promise.all([
    prisma.entitlementGrant.findUnique({ where: { userId } }),
    prisma.subscription.findMany({ where: { userId } }),
  ]);
  return resolvePlanFromRows({ grant, subscriptions, now });
}

export function canEnableAnotherReminder(plan: Plan, enabledCount: number): boolean {
  return plan === "plus" || enabledCount < FREE_REMINDER_LIMIT;
}
