import { beforeEach, describe, expect, it, vi } from "vitest";

// Wiring test for the exported wrappers. createServerFn is replaced by a recorder so we can check how each
// server function is declared (POST, authMiddleware, validator) and simulate how a call settles.
const h = vi.hoisted(() => {
  type Handler = (ctx: { data: unknown; context: { userId: string } }) => unknown;
  interface Registered {
    method: string;
    middleware: unknown[];
    validator?: { parse: (v: unknown) => unknown };
    handler: Handler;
    call: (opts?: { data?: unknown }) => Promise<unknown>;
  }
  const state = {
    mode: "ok" as "ok" | "unauthorized" | "unavailable",
    registered: [] as Registered[],
  };
  const createServerFn = (opts: { method: string }) => {
    const def: Partial<Registered> = { method: opts.method, middleware: [] };
    const builder = {
      middleware(m: unknown[]) {
        def.middleware = m;
        return builder;
      },
      validator(v: Registered["validator"]) {
        def.validator = v;
        return builder;
      },
      handler(handler: Handler) {
        const call = vi.fn(async (o?: { data?: unknown }) => {
          // Mirrors Start: auth middleware first, then the validator, then the handler.
          if (state.mode === "unauthorized") throw new Error("Unauthorized");
          if (state.mode === "unavailable") throw new Error("auth_unavailable");
          const data = def.validator ? def.validator.parse(o?.data) : o?.data;
          return handler({ data, context: { userId: "user-uuid" } });
        });
        Object.assign(def, { handler, call });
        state.registered.push(def as Registered);
        return call;
      },
    };
    return builder;
  };
  return { state, createServerFn };
});

vi.mock("@tanstack/react-start", () => ({ createServerFn: h.createServerFn }));
vi.mock("@/server/auth-middleware", () => ({ authMiddleware: { marker: "authMiddleware" } }));
vi.mock("@/server/planner-impl", () => {
  const names = [
    "getDailyLog", "saveDailyLog", "listPrayerGoals", "createPrayerGoal", "updatePrayerGoal",
    "deletePrayerGoal", "listPlanTasks", "createPlanTask", "updatePlanTask", "deletePlanTask",
    "listReminderRules", "createReminderRule", "updateReminderRule", "deleteReminderRule",
    "getUserProfile", "updateUserProfile",
  ];
  return Object.fromEntries(
    names.map((n) => [`${n}Impl`, vi.fn(async (userId: string, arg?: unknown) => ({ ok: true, data: { impl: n, userId, arg } }))]),
  );
});

import * as planner from "./planner";
import * as impl from "@/server/planner-impl";
import * as schemas from "./planner-schemas";

const ID = "11111111-1111-4111-8111-111111111111";

// [wrapper, valid args, impl name, the arg the Impl receives, schema, invalid args, invalid error]
const cases = [
  ["getDailyLogAction", [5], "getDailyLogImpl", 5, schemas.daySchema, [0], "invalid_day"],
  ["saveDailyLogAction", [{ day: 2, dayTaskDone: true }], "saveDailyLogImpl", { day: 2, dayTaskDone: true }, schemas.saveDailyLogSchema, [{ day: 31 }], "invalid_input"],
  ["listPrayerGoalsAction", [], "listPrayerGoalsImpl", undefined, null, null, null],
  ["createPrayerGoalAction", [{ title: "a", targetCount: 1, targetUnit: "x" }], "createPrayerGoalImpl", { title: "a", targetCount: 1, targetUnit: "x" }, schemas.createGoalSchema, [{ title: "", targetCount: 1, targetUnit: "x" }], "invalid_input"],
  ["updatePrayerGoalAction", [{ id: ID, title: "a", targetCount: 1, targetUnit: "x", isCompleted: true }], "updatePrayerGoalImpl", { id: ID, title: "a", targetCount: 1, targetUnit: "x", isCompleted: true }, schemas.updateGoalSchema, [{ id: "x", title: "a", targetCount: 1, targetUnit: "x", isCompleted: true }], "invalid_input"],
  ["deletePrayerGoalAction", [ID], "deletePrayerGoalImpl", ID, schemas.deleteSchema, ["nope"], "invalid_input"],
  ["listPlanTasksAction", [], "listPlanTasksImpl", undefined, null, null, null],
  ["createPlanTaskAction", [{ title: "t" }], "createPlanTaskImpl", { title: "t" }, schemas.createTaskSchema, [{ title: "" }], "invalid_input"],
  ["updatePlanTaskAction", [{ id: ID, title: "t", isDone: false }], "updatePlanTaskImpl", { id: ID, title: "t", isDone: false }, schemas.updateTaskSchema, [{ id: ID, title: "t" }], "invalid_input"],
  ["deletePlanTaskAction", [ID], "deletePlanTaskImpl", ID, schemas.deleteSchema, [""], "invalid_input"],
  ["listReminderRulesAction", [], "listReminderRulesImpl", undefined, null, null, null],
  ["createReminderRuleAction", [{ type: "fajr", label: "", offsetMinutes: 0, channels: ["push"], enabled: true }], "createReminderRuleImpl", { type: "fajr", label: "", offsetMinutes: 0, channels: ["push"], enabled: true }, schemas.createReminderSchema, [{ type: "nope", label: "", offsetMinutes: 0, channels: ["push"], enabled: true }], "invalid_input"],
  ["updateReminderRuleAction", [{ id: ID, type: "fajr", label: "", offsetMinutes: 0, channels: ["push"], enabled: true }], "updateReminderRuleImpl", { id: ID, type: "fajr", label: "", offsetMinutes: 0, channels: ["push"], enabled: true }, schemas.updateReminderSchema, [{ id: ID, type: "fajr", label: "", offsetMinutes: 0, channels: [], enabled: true }], "invalid_input"],
  ["deleteReminderRuleAction", [ID], "deleteReminderRuleImpl", ID, schemas.deleteSchema, [123], "invalid_input"],
  ["getUserProfileAction", [], "getUserProfileImpl", undefined, null, null, null],
  ["updateUserProfileAction", [{ displayName: "", timezone: "UTC", locationLabel: "x", latitude: 0, longitude: 0 }], "updateUserProfileImpl", { displayName: "", timezone: "UTC", locationLabel: "x", latitude: 0, longitude: 0 }, schemas.updateProfileSchema, [{ displayName: "", timezone: "UTC", locationLabel: "x", latitude: 0, longitude: 181 }], "invalid_input"],
] as const;

type AnyFn = (...args: unknown[]) => Promise<unknown>;
const wrapper = (name: string) => (planner as unknown as Record<string, AnyFn>)[name];
const implFn = (name: string) => (impl as unknown as Record<string, ReturnType<typeof vi.fn>>)[name];

beforeEach(() => {
  h.state.mode = "ok";
  for (const r of h.state.registered) (r.call as ReturnType<typeof vi.fn>).mockClear();
  for (const [, , implName] of cases) implFn(implName).mockClear();
});

describe("planner server function declarations", () => {
  it("declares exactly 16 POST server functions, all behind authMiddleware", () => {
    expect(h.state.registered).toHaveLength(cases.length);
    for (const r of h.state.registered) {
      expect(r.method).toBe("POST");
      expect(r.middleware).toEqual([{ marker: "authMiddleware" }]);
    }
  });

  it("uses the old action's own zod schema as the validator", () => {
    const validators = h.state.registered.map((r) => r.validator ?? null);
    expect(validators).toEqual(cases.map((c) => c[4]));
  });

  it("exports no `use server` style leftovers: every wrapper is an async function", () => {
    for (const [name] of cases) expect(typeof wrapper(name)).toBe("function");
  });
});

describe.each(cases)("%s", (name, args, implName, implArg, _schema, invalidArgs, invalidError) => {
  it("happy path: calls the server function and the Impl with the middleware's userId", async () => {
    const result = await wrapper(name)(...args);
    expect(result).toMatchObject({ ok: true, data: { userId: "user-uuid" } });
    const call = implFn(implName).mock.calls[0];
    expect(call[0]).toBe("user-uuid");
    expect(call[1]).toEqual(implArg);
  });

  it("signed out: the 401 rejection becomes { ok: false, error: 'unauthorized' }", async () => {
    h.state.mode = "unauthorized";
    await expect(wrapper(name)(...args)).resolves.toEqual({ ok: false, error: "unauthorized" });
    expect(implFn(implName)).not.toHaveBeenCalled();
  });

  it("other failures (503 auth_unavailable) are rethrown, not turned into a result", async () => {
    h.state.mode = "unavailable";
    await expect(wrapper(name)(...args)).rejects.toThrow("auth_unavailable");
  });

  if (invalidArgs) {
    it(`invalid input returns ${invalidError} without calling the server`, async () => {
      h.state.mode = "unauthorized"; // like before, validation is checked before auth
      await expect(wrapper(name)(...invalidArgs)).resolves.toEqual({ ok: false, error: invalidError });
      for (const r of h.state.registered) expect(r.call).not.toHaveBeenCalled();
    });
  }
});
