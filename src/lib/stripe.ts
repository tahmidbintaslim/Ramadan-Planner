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

// Trimmed: a stray newline or space in a dashboard-pasted price id must not silently drop events.
const envPrice = (name: "STRIPE_PRICE_MONTHLY" | "STRIPE_PRICE_YEARLY") => process.env[name]?.trim() ?? "";

export function priceIdForInterval(interval: Interval): string {
  const name = interval === "month" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_YEARLY";
  const id = envPrice(name);
  if (!id) throw new Error(`${name} is not set`);
  return id;
}

export const pricesConfigured = (): boolean => !!envPrice("STRIPE_PRICE_MONTHLY") && !!envPrice("STRIPE_PRICE_YEARLY");

export function isAllowedPrice(priceId: string): boolean {
  if (!priceId) return false;
  return [envPrice("STRIPE_PRICE_MONTHLY"), envPrice("STRIPE_PRICE_YEARLY")].some((id) => !!id && id === priceId);
}

export const trialDaysFor = (hasHadSubscription: boolean): number => (hasHadSubscription ? 0 : 7);
