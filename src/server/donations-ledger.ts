// Turns verified Stripe events into rows of the anonymous `donations` ledger (supabase/migrations/009_donations.sql).
// No donor PII is ever stored: no name, email, address or card details; only the billing country when Stripe
// has one. Each row carries the Stripe event id (unique), which makes a retried or duplicated delivery a no-op.
import "@tanstack/react-start/server-only";
import type Stripe from "stripe";
import { DONATION_CURRENCIES, type DonationCurrency, type DonationFrequency } from "@/lib/donations";

/** Every Checkout Session, PaymentIntent and Subscription this app creates carries this metadata. */
export const DONATION_APP = "ramadan-planner";

export type DonationStatus = "succeeded" | "refunded";

export interface DonationRow {
  stripeEventId: string;
  /** PaymentIntent id of the payment (refund rows repeat the refunded payment's id). */
  stripeObjectId: string;
  /** Subscription id for monthly donations, so the public donor count counts a monthly donor once. */
  stripeSubscriptionId: string | null;
  amountMinor: number;
  currency: DonationCurrency;
  frequency: DonationFrequency;
  status: DonationStatus;
  /** ISO 3166-1 alpha-2 billing country when Stripe has one; never more address than that. */
  country: string | null;
}

export interface DonationDb {
  /** Inserts the row unless its stripeEventId is already stored; false for a duplicate. */
  insert(row: DonationRow): Promise<boolean>;
  /** The succeeded donation recorded for a PaymentIntent, or null when it is not one of ours. */
  findPayment(
    stripeObjectId: string,
  ): Promise<Pick<DonationRow, "currency" | "frequency" | "stripeSubscriptionId"> | null>;
}

export interface LedgerDeps {
  db: DonationDb;
  /** PaymentIntent id that paid an invoice (one Stripe read), or null if it has none. */
  paymentIntentForInvoice(invoiceId: string): Promise<string | null>;
}

export type LedgerResult = "recorded" | "duplicate" | "ignored";

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : (v?.id ?? null);

const asCurrency = (c: string | null | undefined): DonationCurrency | null =>
  (DONATION_CURRENCIES as readonly string[]).includes(c?.toLowerCase() ?? "") ? (c!.toLowerCase() as DonationCurrency) : null;

const asCountry = (c: string | null | undefined): string | null => (c && /^[A-Z]{2}$/.test(c) ? c : null);

/**
 * Applies one verified event. Handles:
 *  - checkout.session.completed / .async_payment_succeeded: a paid one-time donation (mode "payment");
 *    subscription checkouts are skipped here because their first invoice arrives as invoice.paid.
 *  - invoice.paid: each paid month of a monthly donation.
 *  - charge.refunded: the newly refunded part of a payment already in the ledger.
 * Anything else, or anything not tagged metadata.app = "ramadan-planner", is ignored (the Stripe account may
 * hold other products). Throws only on a Stripe or database failure, so the webhook answers 5xx and Stripe retries.
 */
export async function applyDonationEvent(event: Stripe.Event, deps: LedgerDeps): Promise<LedgerResult> {
  const row = await rowFor(event, deps);
  if (!row) return "ignored";
  return (await deps.db.insert(row)) ? "recorded" : "duplicate";
}

async function rowFor(event: Stripe.Event, deps: LedgerDeps): Promise<DonationRow | null> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.metadata?.app !== DONATION_APP || s.mode !== "payment" || s.payment_status !== "paid") return null;
      const currency = asCurrency(s.currency);
      if (!currency || !s.amount_total || s.amount_total <= 0) return null;
      return {
        stripeEventId: event.id,
        stripeObjectId: idOf(s.payment_intent) ?? s.id,
        stripeSubscriptionId: null,
        amountMinor: s.amount_total,
        currency,
        frequency: "once",
        status: "succeeded",
        country: asCountry(s.customer_details?.address?.country),
      };
    }
    case "invoice.paid": {
      const inv = event.data.object;
      const details = inv.parent?.subscription_details;
      if (!details || details.metadata?.app !== DONATION_APP) return null;
      const currency = asCurrency(inv.currency);
      if (!currency || inv.amount_paid <= 0) return null;
      const fromPayload = idOf(inv.payments?.data?.find((p) => p.payment?.payment_intent)?.payment.payment_intent);
      const pi = fromPayload ?? (inv.id ? await deps.paymentIntentForInvoice(inv.id) : null);
      return {
        stripeEventId: event.id,
        stripeObjectId: pi ?? inv.id ?? event.id,
        stripeSubscriptionId: idOf(details.subscription),
        amountMinor: inv.amount_paid,
        currency,
        frequency: "monthly",
        status: "succeeded",
        country: asCountry(inv.customer_address?.country),
      };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = idOf(charge.payment_intent);
      if (!pi) return null;
      const original = await deps.db.findPayment(pi);
      if (!original) return null;
      // charge.amount_refunded is cumulative; previous_attributes holds the value before this refund, so a
      // second partial refund records only its own part.
      const before = (event.data.previous_attributes as Partial<Stripe.Charge> | undefined)?.amount_refunded ?? 0;
      const delta = charge.amount_refunded - before;
      if (delta <= 0) return null;
      return {
        stripeEventId: event.id,
        stripeObjectId: pi,
        stripeSubscriptionId: original.stripeSubscriptionId,
        amountMinor: delta,
        currency: original.currency,
        frequency: original.frequency,
        status: "refunded",
        country: null,
      };
    }
    default:
      return null;
  }
}

/** Prisma-backed ledger. Prisma is imported lazily so this module loads (and is testable) without a database. */
export const prismaDonationDb: DonationDb = {
  async insert(row) {
    const { prisma } = await import("@/lib/prisma");
    const { count } = await prisma.donation.createMany({ data: [row], skipDuplicates: true });
    return count === 1;
  },
  async findPayment(stripeObjectId) {
    const { prisma } = await import("@/lib/prisma");
    const found = await prisma.donation.findFirst({
      where: { stripeObjectId, status: "succeeded" },
      select: { currency: true, frequency: true, stripeSubscriptionId: true },
    });
    if (!found) return null;
    const currency = asCurrency(found.currency);
    if (!currency) return null;
    return {
      currency,
      frequency: found.frequency === "monthly" ? "monthly" : "once",
      stripeSubscriptionId: found.stripeSubscriptionId,
    };
  },
};
