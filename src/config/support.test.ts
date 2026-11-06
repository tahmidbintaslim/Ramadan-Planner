import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  MIN_AMOUNT,
  SUPPORT_CONFIG,
  configuredWallets,
  mailtoHref,
  normalizeBdMobile,
  parseAmount,
  safeHttpUrl,
  toAsciiDigits,
} from "./support";

describe("shipped config", () => {
  it("starts with nothing configured: payments disabled, no tax claim, repo set", () => {
    expect(configuredWallets(SUPPORT_CONFIG)).toEqual([]);
    expect(SUPPORT_CONFIG.cardUrl).toBeNull();
    // Card donations stay off unless VITE_STRIPE_DONATIONS_ENABLED is "true" at build time.
    expect(SUPPORT_CONFIG.stripeEnabled).toBe(false);
    expect(SUPPORT_CONFIG.ledgerUrl).toBeNull();
    expect(SUPPORT_CONFIG.taxDeductible).toBe(false);
    expect(SUPPORT_CONFIG.repoUrl).toBe("https://github.com/tahmidbintaslim/Ramadan-Planner");
    expect(Object.values(SUPPORT_CONFIG.costs).every((c) => c === null)).toBe(true);
  });
});

describe("normalizeBdMobile", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["017-1234 5678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["8801912345678", "01912345678"],
    ["০১৭১২৩৪৫৬৭৮", "01712345678"],
  ])("accepts %s", (input, expected) => expect(normalizeBdMobile(input)).toBe(expected));
  it.each(["", null, undefined, "0171234567", "02712345678", "abc", "01212345678", "017123456789"])(
    "rejects %s",
    (input) => expect(normalizeBdMobile(input as string | null | undefined)).toBeNull(),
  );
});

describe("configuredWallets", () => {
  it("lists bKash then Nagad and drops malformed numbers", () => {
    expect(configuredWallets({ bkashNumber: "01711111111", nagadNumber: "01822222222" })).toEqual([
      { id: "bkash", number: "01711111111" },
      { id: "nagad", number: "01822222222" },
    ]);
    expect(configuredWallets({ bkashNumber: "oops", nagadNumber: "01822222222" })).toEqual([
      { id: "nagad", number: "01822222222" },
    ]);
  });
});

describe("parseAmount", () => {
  it("parses ASCII and Bengali digits, commas and the taka sign", () => {
    expect(parseAmount("250")).toEqual({ ok: true, amount: 250 });
    expect(parseAmount("২৫০")).toEqual({ ok: true, amount: 250 });
    expect(parseAmount("৳ 1,500")).toEqual({ ok: true, amount: 1500 });
  });
  it("checks the bounds inclusively", () => {
    expect(parseAmount(String(MIN_AMOUNT))).toEqual({ ok: true, amount: MIN_AMOUNT });
    expect(parseAmount(String(MIN_AMOUNT - 1))).toEqual({ ok: false, reason: "min" });
    expect(parseAmount(String(MAX_AMOUNT))).toEqual({ ok: true, amount: MAX_AMOUNT });
    expect(parseAmount(String(MAX_AMOUNT + 1))).toEqual({ ok: false, reason: "max" });
  });
  it("rejects empty, decimals, negatives and text", () => {
    expect(parseAmount("  ")).toEqual({ ok: false, reason: "empty" });
    for (const bad of ["12.5", "-50", "abc", "1e3", "5 0 x"]) {
      expect(parseAmount(bad)).toEqual({ ok: false, reason: "invalid" });
    }
  });
  it("rejects absurdly long digit strings", () => {
    expect(parseAmount("9".repeat(40)).ok).toBe(false);
  });
});

describe("links", () => {
  it("safeHttpUrl only passes http(s)", () => {
    expect(safeHttpUrl("https://opencollective.com/x")).toBe("https://opencollective.com/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
  it("mailtoHref validates and encodes the subject", () => {
    expect(mailtoHref("a@b.org", "মসজিদ & সহযোগিতা")).toBe(`mailto:a@b.org?subject=${encodeURIComponent("মসজিদ & সহযোগিতা")}`);
    expect(mailtoHref("nope", "x")).toBeNull();
    expect(mailtoHref(null, "x")).toBeNull();
  });
  it("toAsciiDigits converts Bengali digits only", () => {
    expect(toAsciiDigits("৳১২৩abc")).toBe("৳123abc");
  });
});
