// Planner server functions. Each `xAction` keeps its old name, arguments and ActionResult shape, and calls a
// POST server function behind `authMiddleware` (HTTP 401 when signed out). The bodies live in
// src/server/planner-impl.ts (server-only); the Start compiler strips the handlers, and with them that
// import, from the client bundle.
import { callAuthed } from "@/server/call-authed";
import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { authMiddleware } from "@/server/auth-middleware";
import {
  createPlanTaskImpl,
  createPrayerGoalImpl,
  createReminderRuleImpl,
  deletePlanTaskImpl,
  deletePrayerGoalImpl,
  deleteReminderRuleImpl,
  getDailyLogImpl,
  getUserProfileImpl,
  listPlanTasksImpl,
  listPrayerGoalsImpl,
  listReminderRulesImpl,
  saveDailyLogImpl,
  updatePlanTaskImpl,
  updatePrayerGoalImpl,
  updateReminderRuleImpl,
  updateUserProfileImpl,
} from "@/server/planner-impl";
import {
  createGoalSchema,
  createReminderSchema,
  createTaskSchema,
  daySchema,
  deleteSchema,
  saveDailyLogSchema,
  updateGoalSchema,
  updateProfileSchema,
  updateReminderSchema,
  updateTaskSchema,
  type ActionResult,
  type DailyLogDTO,
  type PlanTaskDTO,
  type PrayerGoalDTO,
  type ReminderRuleDTO,
  type UserProfileDTO,
} from "./planner-schemas";

export type {
  ActionResult,
  DailyLogDTO,
  PlanTaskDTO,
  PrayerGoalDTO,
  ReminderRuleDTO,
  UserProfileDTO,
} from "./planner-schemas";


// Server functions. The validator is the same schema the old action used; it runs on the server after
// authMiddleware. The wrappers below check the same schema first, so invalid input still returns the old
// error string (before auth, as before) instead of a thrown validation error.

const getDailyLogFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(daySchema)
  .handler(({ data, context }) => getDailyLogImpl(context.userId, data.day, data.date));

const saveDailyLogFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saveDailyLogSchema)
  .handler(({ data, context }) => saveDailyLogImpl(context.userId, data));

const listPrayerGoalsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => listPrayerGoalsImpl(context.userId));

const createPrayerGoalFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createGoalSchema)
  .handler(({ data, context }) => createPrayerGoalImpl(context.userId, data));

const updatePrayerGoalFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateGoalSchema)
  .handler(({ data, context }) => updatePrayerGoalImpl(context.userId, data));

const deletePrayerGoalFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deleteSchema)
  .handler(({ data, context }) => deletePrayerGoalImpl(context.userId, data.id));

const listPlanTasksFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => listPlanTasksImpl(context.userId));

const createPlanTaskFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createTaskSchema)
  .handler(({ data, context }) => createPlanTaskImpl(context.userId, data));

const updatePlanTaskFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateTaskSchema)
  .handler(({ data, context }) => updatePlanTaskImpl(context.userId, data));

const deletePlanTaskFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deleteSchema)
  .handler(({ data, context }) => deletePlanTaskImpl(context.userId, data.id));

const listReminderRulesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => listReminderRulesImpl(context.userId));

const createReminderRuleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createReminderSchema)
  .handler(({ data, context }) => createReminderRuleImpl(context.userId, data));

const updateReminderRuleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateReminderSchema)
  .handler(({ data, context }) => updateReminderRuleImpl(context.userId, data));

const deleteReminderRuleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deleteSchema)
  .handler(({ data, context }) => deleteReminderRuleImpl(context.userId, data.id));

const getUserProfileFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => getUserProfileImpl(context.userId));

const updateUserProfileFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateProfileSchema)
  .handler(({ data, context }) => updateUserProfileImpl(context.userId, data));

// Exported wrappers: unchanged names, arguments and return types.

/** `todayISO` is the user's local date (YYYY-MM-DD); it picks the Ramadan year the day belongs to. */
export async function getDailyLogAction(
  day: number,
  todayISO?: string,
): Promise<ActionResult<DailyLogDTO | null>> {
  const data = todayISO === undefined ? { day } : { day, date: todayISO };
  if (!daySchema.safeParse(data).success) {
    return { ok: false, error: "invalid_day" };
  }
  return callAuthed(() => getDailyLogFn({ data }));
}

export async function saveDailyLogAction(
  input: z.infer<typeof saveDailyLogSchema>,
): Promise<ActionResult<DailyLogDTO>> {
  if (!saveDailyLogSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => saveDailyLogFn({ data: input }));
}

export async function listPrayerGoalsAction(): Promise<ActionResult<PrayerGoalDTO[]>> {
  return callAuthed(() => listPrayerGoalsFn());
}

export async function createPrayerGoalAction(
  input: z.infer<typeof createGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  if (!createGoalSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => createPrayerGoalFn({ data: input }));
}

export async function updatePrayerGoalAction(
  input: z.infer<typeof updateGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  if (!updateGoalSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => updatePrayerGoalFn({ data: input }));
}

export async function deletePrayerGoalAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!deleteSchema.safeParse({ id }).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => deletePrayerGoalFn({ data: { id } }));
}

export async function listPlanTasksAction(): Promise<ActionResult<PlanTaskDTO[]>> {
  return callAuthed(() => listPlanTasksFn());
}

export async function createPlanTaskAction(
  input: z.infer<typeof createTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  if (!createTaskSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => createPlanTaskFn({ data: input }));
}

export async function updatePlanTaskAction(
  input: z.infer<typeof updateTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  if (!updateTaskSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => updatePlanTaskFn({ data: input }));
}

export async function deletePlanTaskAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!deleteSchema.safeParse({ id }).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => deletePlanTaskFn({ data: { id } }));
}

export async function listReminderRulesAction(): Promise<
  ActionResult<ReminderRuleDTO[]>
> {
  return callAuthed(() => listReminderRulesFn());
}

export async function createReminderRuleAction(
  input: z.infer<typeof createReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  if (!createReminderSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => createReminderRuleFn({ data: input }));
}

export async function updateReminderRuleAction(
  input: z.infer<typeof updateReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  if (!updateReminderSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => updateReminderRuleFn({ data: input }));
}

export async function deleteReminderRuleAction(
  id: string,
): Promise<ActionResult<null>> {
  if (!deleteSchema.safeParse({ id }).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => deleteReminderRuleFn({ data: { id } }));
}

export async function getUserProfileAction(): Promise<ActionResult<UserProfileDTO>> {
  return callAuthed(() => getUserProfileFn());
}

export async function updateUserProfileAction(
  input: z.infer<typeof updateProfileSchema>,
): Promise<ActionResult<UserProfileDTO>> {
  if (!updateProfileSchema.safeParse(input).success) {
    return { ok: false, error: "invalid_input" };
  }
  return callAuthed(() => updateUserProfileFn({ data: input }));
}
