import Stripe from "stripe";
import { z } from "zod";

export const intervalSchema = z.enum(["month", "year"]);
export type Interval = z.infer<typeof intervalSchema>;

let client: Stripe | undefined;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key, { apiVersion: "2026-10-28.endive" }));
}

export function priceIdForInterval(interval: Interval): string {
  const name = interval === "month" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_YEARLY";
  const id = process.env[name];
  if (!id) throw new Error(`${name} is not set`);
  return id;
}

export function isAllowedPrice(priceId: string): boolean {
  if (!priceId) return false;
  return [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_YEARLY].some((id) => !!id && id === priceId);
}

export const trialDaysFor = (hasHadSubscription: boolean): number => (hasHadSubscription ? 0 : 7);
