// Sadaqah & contribute page configuration (design system v2, Task 10).
//
// The FOUNDER fills this file in. Nothing here is a secret: personal bKash/Nagad numbers are meant to be shown to
// donors. No payment is processed in the app and no payment SDK is used; the page only shows a number to copy and
// links out. Leave a value `null` and the matching control stays disabled or hidden ("শীঘ্রই চালু হবে").

export type CostKey = "server" | "push" | "translation";

export interface SupportConfig {
  /** Personal bKash number for Send Money (e.g. "01XXXXXXXXX"). `null` until configured. */
  bkashNumber: string | null;
  /** Personal Nagad number for Send Money. `null` until configured. */
  nagadNumber: string | null;
  /** Card donation page for the diaspora (e.g. an Open Collective URL). `null` until configured. */
  cardUrl: string | null;
  /** Public page listing every transaction. The "receipt" row is hidden while this is `null`. */
  ledgerUrl: string | null;
  /** Source code repository. */
  repoUrl: string;
  /** Contact address for mosque / institution partnerships. `null` hides that mail link. */
  contactEmail: string | null;
  /** Show "tax-deductible" wording only once a registered entity can really issue deductible receipts. */
  taxDeductible: boolean;
  /** Estimated Ramadan running costs, as display text in whole taka (e.g. "৳১২,০০০"). `null` shows a placeholder. */
  costs: Record<CostKey, string | null>;
}

export const SUPPORT_CONFIG: SupportConfig = {
  bkashNumber: null,
  nagadNumber: null,
  cardUrl: null,
  ledgerUrl: null,
  repoUrl: "https://github.com/tahmidbintaslim/Ramadan-Planner",
  contactEmail: null,
  taxDeductible: false,
  costs: { server: null, push: null, translation: null },
};

export const COST_KEYS: CostKey[] = ["server", "push", "translation"];

/** Preset amounts (taka) offered as chips; "other" opens a number field. */
export const PRESET_AMOUNTS = [50, 100, 500] as const;
export const DEFAULT_AMOUNT = 100;
export const MIN_AMOUNT = 10;
export const MAX_AMOUNT = 1_000_000;

/** The reference text donors put in the Send Money "reference" field, so the ledger can match it. */
export const PAYMENT_REFERENCE = "Ramadan Planner";

export type WalletId = "bkash" | "nagad";

export interface Wallet {
  id: WalletId;
  /** Normalised 11-digit local number, e.g. "01712345678". */
  number: string;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits to ASCII; everything else is left as is. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** A Bangladeshi mobile number (01[3-9] + 8 digits), accepting "+880" / "880" / spaces / dashes. `null` if invalid. */
export function normalizeBdMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = toAsciiDigits(input).replace(/[\s-]/g, "");
  if (digits.startsWith("+880")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("880")) digits = `0${digits.slice(3)}`;
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/** The wallets that are properly configured. A malformed number counts as not configured (never show a typo). */
export function configuredWallets(config: Pick<SupportConfig, "bkashNumber" | "nagadNumber">): Wallet[] {
  const wallets: Wallet[] = [];
  const bkash = normalizeBdMobile(config.bkashNumber);
  if (bkash) wallets.push({ id: "bkash", number: bkash });
  const nagad = normalizeBdMobile(config.nagadNumber);
  if (nagad) wallets.push({ id: "nagad", number: nagad });
  return wallets;
}

export type AmountResult = { ok: true; amount: number } | { ok: false; reason: "empty" | "invalid" | "min" | "max" };

/** Parse a typed taka amount (Bengali or ASCII digits, optional commas / ৳). Whole taka only. */
export function parseAmount(input: string): AmountResult {
  const cleaned = toAsciiDigits(input).replace(/[,\s৳]/g, "");
  if (cleaned === "") return { ok: false, reason: "empty" };
  if (!/^\d+$/.test(cleaned)) return { ok: false, reason: "invalid" };
  const amount = Number(cleaned);
  if (!Number.isSafeInteger(amount)) return { ok: false, reason: "invalid" };
  if (amount < MIN_AMOUNT) return { ok: false, reason: "min" };
  if (amount > MAX_AMOUNT) return { ok: false, reason: "max" };
  return { ok: true, amount };
}

/** Only http(s) URLs may be linked from config (guards a mistyped or hostile value). */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function mailtoHref(email: string | null | undefined, subject: string): string | null {
  const e = email?.trim();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return `mailto:${e}?subject=${encodeURIComponent(subject)}`;
}
