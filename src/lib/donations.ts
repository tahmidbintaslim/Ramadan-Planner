// Card donation rules shared by the /support form (client) and POST /api/donations/checkout (server).
// Pure and client-safe: no Stripe SDK, no secrets. The server re-validates everything the client sends.
import { z } from "zod";

/**
 * Presentment currencies offered for card donations. Stripe lists BDT as a supported (two-decimal)
 * presentment currency for card charges, so it stays; it is converted to the account's settlement currency.
 */
export const DONATION_CURRENCIES = ["usd", "gbp", "eur", "bdt"] as const;
export type DonationCurrency = (typeof DONATION_CURRENCIES)[number];

/** Monthly (subscription) donations are offered only in these; BDT is one-time only. */
export const MONTHLY_CURRENCIES: readonly DonationCurrency[] = ["usd", "gbp", "eur"];

export const DONATION_FREQUENCIES = ["once", "monthly"] as const;
export type DonationFrequency = (typeof DONATION_FREQUENCIES)[number];

/**
 * Bounds in MAJOR units (dollars, pounds, euros, taka). USD/GBP/EUR: 1 to 10,000. BDT starts at 100 because
 * Stripe rejects charges below about USD 0.50 after conversion (1 taka is far below that), and stops at
 * 500,000 so the minor-unit amount stays well inside Stripe's 8-digit limit.
 */
export const AMOUNT_BOUNDS: Record<DonationCurrency, { min: number; max: number }> = {
  usd: { min: 1, max: 10_000 },
  gbp: { min: 1, max: 10_000 },
  eur: { min: 1, max: 10_000 },
  bdt: { min: 100, max: 500_000 },
};

/** Preset chips per currency (major units). */
export const CARD_PRESETS: Record<DonationCurrency, readonly number[]> = {
  usd: [5, 10, 25],
  gbp: [5, 10, 25],
  eur: [5, 10, 25],
  bdt: [500, 1000, 2500],
};

/** Every offered currency has two decimals in Stripe (none is zero-decimal), so minor = major x 100. */
const MINOR_PER_MAJOR: Record<DonationCurrency, number> = { usd: 100, gbp: 100, eur: 100, bdt: 100 };

export const supportsMonthly = (currency: DonationCurrency): boolean => MONTHLY_CURRENCIES.includes(currency);

/** At most two decimal places (cents/pence/paisa), checked on the scaled value to dodge float noise. */
function hasAtMostTwoDecimals(amount: number): boolean {
  const scaled = amount * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Major units to Stripe's integer minor units, e.g. 12.34 USD -> 1234, 500 BDT -> 50000. */
export function toMinorUnits(amount: number, currency: DonationCurrency): number {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("amount must be a non-negative finite number");
  if (!hasAtMostTwoDecimals(amount)) throw new RangeError("amount has more than two decimal places");
  return Math.round(amount * MINOR_PER_MAJOR[currency]);
}

/** Minor units back to major units, for display. */
export const fromMinorUnits = (minor: number, currency: DonationCurrency): number => minor / MINOR_PER_MAJOR[currency];

export type CheckoutIssue = "amount_invalid" | "amount_min" | "amount_max" | "monthly_unsupported";

export const checkoutRequestSchema = z
  .strictObject({
    amount: z.number(),
    currency: z.enum(DONATION_CURRENCIES),
    frequency: z.enum(DONATION_FREQUENCIES),
    locale: z.enum(["bn", "en"]).default("bn"),
  })
  .superRefine((v, ctx) => {
    const issue = checkoutIssue(v.amount, v.currency, v.frequency);
    if (issue) ctx.addIssue({ code: "custom", message: issue, path: [issue === "monthly_unsupported" ? "frequency" : "amount"] });
  });

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/** The first problem with an amount/currency/frequency combination, or null when it can be charged. */
export function checkoutIssue(amount: number, currency: DonationCurrency, frequency: DonationFrequency): CheckoutIssue | null {
  if (!Number.isFinite(amount) || amount <= 0 || !hasAtMostTwoDecimals(amount)) return "amount_invalid";
  const { min, max } = AMOUNT_BOUNDS[currency];
  if (amount < min) return "amount_min";
  if (amount > max) return "amount_max";
  if (frequency === "monthly" && !supportsMonthly(currency)) return "monthly_unsupported";
  return null;
}

/**
 * Parse a typed amount (Bengali or ASCII digits, optional grouping commas, currency signs, up to two decimals).
 * Returns null when it is not a number; bounds are checked separately with checkoutIssue.
 */
export function parseCardAmount(input: string): number | null {
  const ascii = input.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  const cleaned = ascii.replace(/[,\s৳$£€]/g, "");
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Currency-formatted amount for display (Bengali digits for bn). */
export function formatDonationAmount(major: number, currency: DonationCurrency, locale: string): string {
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat(locale.startsWith("bn") ? "bn-BD-u-nu-beng" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** Public, anonymous ledger returned by GET /api/donations/summary. */
export interface DonationSummaryRow {
  /** "YYYY-MM" (UTC). */
  month: string;
  currency: DonationCurrency;
  /** Successful card donations, minor units. */
  grossMinor: number;
  /** Refunded, minor units. */
  refundedMinor: number;
  /** Successful payments in that month and currency (a monthly donor counts once per month). */
  payments: number;
}

export interface DonationSummary {
  months: DonationSummaryRow[];
  /** Distinct donors: each one-time payment counts once, each monthly subscription counts once. */
  donorCount: number;
  generatedAt: string;
}
