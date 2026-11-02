import { FREE_REMINDER_LIMIT, type Plan } from "./entitlements";

export function limitRulesForPlan<T extends { createdAt: Date; enabled: boolean }>(rules: T[], plan: Plan): T[] {
  if (plan === "plus") return rules;
  // Array.prototype.sort is stable, so equal createdAt keeps input order.
  return rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, FREE_REMINDER_LIMIT);
}
