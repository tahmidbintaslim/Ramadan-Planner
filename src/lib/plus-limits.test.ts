import { describe, expect, it } from "vitest";
import { limitRulesForPlan } from "./plus-limits";

const rule = (id: string, day: number, enabled = true) => ({ id, createdAt: new Date(2026, 0, day), enabled });

describe("limitRulesForPlan", () => {
  it("free: keeps the 3 oldest enabled", () => {
    const rules = [rule("e", 5), rule("b", 2), rule("d", 4), rule("a", 1), rule("c", 3)];
    expect(limitRulesForPlan(rules, "free").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("free: drops disabled rules and does not count them", () => {
    const rules = [rule("a", 1, false), rule("b", 2), rule("c", 3), rule("d", 4)];
    expect(limitRulesForPlan(rules, "free").map((r) => r.id)).toEqual(["b", "c", "d"]);
  });
  it("plus: returns everything in the same order", () => {
    const rules = [rule("b", 2, false), rule("a", 1), rule("c", 3), rule("d", 4), rule("e", 5)];
    expect(limitRulesForPlan(rules, "plus")).toEqual(rules);
  });
  it("handles empty input and does not mutate", () => {
    expect(limitRulesForPlan([], "free")).toEqual([]);
    const rules = [rule("b", 2), rule("a", 1)];
    const copy = [...rules];
    limitRulesForPlan(rules, "free");
    expect(rules).toEqual(copy);
  });
  it("stable order for equal createdAt", () => {
    const rules = ["a", "b", "c", "d", "e"].map((id) => rule(id, 1));
    expect(limitRulesForPlan(rules, "free").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
