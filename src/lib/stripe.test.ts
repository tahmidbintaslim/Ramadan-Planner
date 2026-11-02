import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripe, intervalSchema, isAllowedPrice, priceIdForInterval, trialDaysFor } from "./stripe";

afterEach(() => vi.unstubAllEnvs());

const prices = () => {
  vi.stubEnv("STRIPE_PRICE_MONTHLY", "price_m");
  vi.stubEnv("STRIPE_PRICE_YEARLY", "price_y");
};

describe("prices", () => {
  it("maps intervals to env price ids", () => {
    prices();
    expect(priceIdForInterval("month")).toBe("price_m");
    expect(priceIdForInterval("year")).toBe("price_y");
  });
  it("allowlists only configured prices", () => {
    prices();
    expect(isAllowedPrice("price_m")).toBe(true);
    expect(isAllowedPrice("price_y")).toBe(true);
    expect(isAllowedPrice("price_other")).toBe(false);
    expect(isAllowedPrice("")).toBe(false);
  });
  it("unset or empty env never allows anything", () => {
    vi.stubEnv("STRIPE_PRICE_MONTHLY", "");
    vi.stubEnv("STRIPE_PRICE_YEARLY", "");
    expect(isAllowedPrice("")).toBe(false);
    expect(isAllowedPrice("price_m")).toBe(false);
    expect(() => priceIdForInterval("month")).toThrow();
    expect(() => priceIdForInterval("year")).toThrow();
  });
});

describe("trial and interval", () => {
  it("trialDaysFor", () => {
    expect(trialDaysFor(false)).toBe(7);
    expect(trialDaysFor(true)).toBe(0);
  });
  it("intervalSchema", () => {
    expect(intervalSchema.safeParse("month").success).toBe(true);
    expect(intervalSchema.safeParse("week").success).toBe(false);
  });
});

describe("getStripe", () => {
  it("throws without secret key, returns singleton with it", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    expect(getStripe()).toBe(getStripe());
  });
});
