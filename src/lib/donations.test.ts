import { describe, expect, it } from "vitest";
import {
  AMOUNT_BOUNDS,
  checkoutIssue,
  checkoutRequestSchema,
  formatDonationAmount,
  fromMinorUnits,
  parseCardAmount,
  supportsMonthly,
  toMinorUnits,
} from "./donations";

describe("toMinorUnits", () => {
  it.each([
    [1, "usd", 100],
    [12.34, "usd", 1234],
    [0.1 + 0.2, "usd", 30], // float noise is rounded, not truncated
    [19.99, "gbp", 1999],
    [10_000, "eur", 1_000_000],
    [500, "bdt", 50_000],
    [500_000, "bdt", 50_000_000],
  ] as const)("%s %s -> %s", (amount, currency, minor) => {
    expect(toMinorUnits(amount, currency)).toBe(minor);
  });

  it("rejects fractions of a cent and invalid numbers", () => {
    expect(() => toMinorUnits(1.234, "usd")).toThrow(RangeError);
    expect(() => toMinorUnits(Number.NaN, "usd")).toThrow(RangeError);
    expect(() => toMinorUnits(-1, "usd")).toThrow(RangeError);
  });

  it("round-trips through fromMinorUnits", () => {
    expect(fromMinorUnits(toMinorUnits(25.5, "eur"), "eur")).toBe(25.5);
  });

  it("keeps every maximum inside Stripe's 8-digit amount limit", () => {
    for (const [currency, { max }] of Object.entries(AMOUNT_BOUNDS)) {
      expect(toMinorUnits(max, currency as keyof typeof AMOUNT_BOUNDS)).toBeLessThanOrEqual(99_999_999);
    }
  });
});

describe("checkoutIssue", () => {
  it("accepts amounts within the bounds", () => {
    expect(checkoutIssue(1, "usd", "once")).toBeNull();
    expect(checkoutIssue(10_000, "gbp", "monthly")).toBeNull();
    expect(checkoutIssue(9.99, "eur", "monthly")).toBeNull();
    expect(checkoutIssue(100, "bdt", "once")).toBeNull();
  });

  it("enforces the per-currency minimum and maximum", () => {
    expect(checkoutIssue(0.99, "usd", "once")).toBe("amount_min");
    expect(checkoutIssue(10_000.01, "usd", "once")).toBe("amount_max");
    expect(checkoutIssue(99, "bdt", "once")).toBe("amount_min");
    expect(checkoutIssue(500_001, "bdt", "once")).toBe("amount_max");
  });

  it("rejects zero, negatives, non-finite values and sub-cent amounts", () => {
    for (const a of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 5.005]) {
      expect(checkoutIssue(a, "usd", "once")).toBe("amount_invalid");
    }
  });

  it("allows monthly only for usd/gbp/eur", () => {
    expect(supportsMonthly("usd") && supportsMonthly("gbp") && supportsMonthly("eur")).toBe(true);
    expect(supportsMonthly("bdt")).toBe(false);
    expect(checkoutIssue(500, "bdt", "monthly")).toBe("monthly_unsupported");
  });
});

describe("checkoutRequestSchema", () => {
  const ok = { amount: 10, currency: "usd", frequency: "once", locale: "en" };

  it("parses a valid request and defaults the locale to bn", () => {
    expect(checkoutRequestSchema.parse(ok)).toEqual(ok);
    expect(checkoutRequestSchema.parse({ amount: 10, currency: "usd", frequency: "once" }).locale).toBe("bn");
  });

  it.each([
    [{ ...ok, currency: "jpy" }],
    [{ ...ok, currency: "USD" }],
    [{ ...ok, frequency: "yearly" }],
    [{ ...ok, amount: "10" }],
    [{ ...ok, amount: 0.5 }],
    [{ ...ok, amount: 20_000 }],
    [{ ...ok, locale: "fr" }],
    [{ ...ok, currency: "bdt", amount: 500, frequency: "monthly" }],
    [{ ...ok, extra: "field" }],
    [null],
  ])("rejects %j", (input) => {
    expect(checkoutRequestSchema.safeParse(input).success).toBe(false);
  });

  it("reports the reason as a custom issue", () => {
    const r = checkoutRequestSchema.safeParse({ ...ok, currency: "bdt", amount: 500, frequency: "monthly" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.code === "custom")?.message).toBe("monthly_unsupported");
  });
});

describe("parseCardAmount", () => {
  it.each([
    ["25", 25],
    ["২৫", 25],
    ["1,000", 1000],
    ["$12.50", 12.5],
    ["৳ ৫০০", 500],
    [".5", 0.5],
  ])("%s -> %s", (input, n) => expect(parseCardAmount(input)).toBe(n));

  it.each(["", "abc", "1.234", "-5", "1e3", "12.3.4"])("%j is not an amount", (input) => {
    expect(parseCardAmount(input)).toBeNull();
  });
});

describe("formatDonationAmount", () => {
  it("formats per currency and locale", () => {
    expect(formatDonationAmount(25, "usd", "en")).toBe("$25");
    expect(formatDonationAmount(12.5, "gbp", "en")).toBe("£12.50");
    expect(formatDonationAmount(500, "bdt", "bn")).toContain("৫০০");
  });
});
