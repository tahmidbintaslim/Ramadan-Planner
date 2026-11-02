import { describe, expect, it } from "vitest";
import { canEnableAnotherReminder, resolvePlan } from "./entitlements";

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
