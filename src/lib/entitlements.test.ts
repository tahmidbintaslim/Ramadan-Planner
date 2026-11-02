import { describe, expect, it } from "vitest";
import { canEnableAnotherReminder, resolvePlan, resolvePlanFromRows } from "./entitlements";

const now = new Date("2026-11-02T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const daysAhead = (n: number) => daysAgo(-n);
const sub = (status: string, currentPeriodEnd: Date | null = null) => ({ status, currentPeriodEnd });

describe("resolvePlan", () => {
  it("no rows -> free/none", () => {
    expect(resolvePlan({ grant: null, subscription: null, now })).toEqual({ plan: "free", source: "none" });
  });
  it("unexpired and null-expiry grants -> plus/grant", () => {
    expect(resolvePlan({ grant: { expiresAt: daysAhead(1) }, subscription: null, now })).toEqual({ plan: "plus", source: "grant" });
    expect(resolvePlan({ grant: { expiresAt: null }, subscription: null, now })).toEqual({ plan: "plus", source: "grant" });
  });
  it("expired grant -> free", () => {
    expect(resolvePlan({ grant: { expiresAt: daysAgo(1) }, subscription: null, now }).plan).toBe("free");
  });
  it.each(["active", "trialing"])("%s -> plus/subscription", (s) => {
    expect(resolvePlan({ grant: null, subscription: sub(s), now })).toEqual({ plan: "plus", source: "subscription" });
  });
  it("past_due honours a 5 day grace", () => {
    expect(resolvePlan({ grant: null, subscription: sub("past_due", daysAgo(4)), now }).plan).toBe("plus");
    expect(resolvePlan({ grant: null, subscription: sub("past_due", daysAgo(6)), now }).plan).toBe("free");
  });
  it.each(["canceled", "incomplete"])("%s -> free", (s) => {
    expect(resolvePlan({ grant: null, subscription: sub(s), now }).plan).toBe("free");
  });
  it("grant beats canceled subscription", () => {
    expect(resolvePlan({ grant: { expiresAt: null }, subscription: sub("canceled"), now })).toEqual({ plan: "plus", source: "grant" });
  });
});

describe("canEnableAnotherReminder", () => {
  it("limits free at 3", () => {
    expect(canEnableAnotherReminder("free", 2)).toBe(true);
    expect(canEnableAnotherReminder("free", 3)).toBe(false);
    expect(canEnableAnotherReminder("plus", 50)).toBe(true);
  });
});

describe("resolvePlanFromRows", () => {
  const plus = { plan: "plus", source: "subscription" };
  const free = { plan: "free", source: "none" };
  it("(a) new active row with earlier period end beats old canceled row", () => {
    const subscriptions = [sub("canceled", daysAhead(300)), sub("active", daysAhead(20))];
    expect(resolvePlanFromRows({ grant: null, subscriptions, now })).toEqual(plus);
  });
  it("(b) active row with null period end beats stale canceled row", () => {
    expect(resolvePlanFromRows({ grant: null, subscriptions: [sub("canceled", daysAgo(10)), sub("active")], now })).toEqual(plus);
  });
  it("(c) only canceled/incomplete rows -> free/none", () => {
    expect(resolvePlanFromRows({ grant: null, subscriptions: [sub("canceled", daysAhead(5)), sub("incomplete")], now })).toEqual(free);
  });
  it("(d) past_due inside grace plus canceled -> plus", () => {
    expect(resolvePlanFromRows({ grant: null, subscriptions: [sub("canceled", daysAhead(9)), sub("past_due", daysAgo(2))], now })).toEqual(plus);
  });
  it("(e) empty rows with valid grant -> plus/grant", () => {
    expect(resolvePlanFromRows({ grant: { expiresAt: null }, subscriptions: [], now })).toEqual({ plan: "plus", source: "grant" });
  });
  it("(f) nothing -> free/none", () => {
    expect(resolvePlanFromRows({ grant: null, subscriptions: [], now })).toEqual(free);
  });
});
