// Server-only implementations of the planner server functions (src/actions/planner.ts).
// Each xImpl is the old xAction body with the auth preamble replaced by the `userId` parameter, which the
// auth middleware supplies (the Clerk user id mapped by clerkIdToUuid). Prisma connects as the database owner,
// which bypasses row-level security: every query MUST be keyed by `userId`.
import "@tanstack/react-start/server-only";
import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { todayISOInZone } from "@/lib/prayer-phase";
import { hijriYearForDate } from "@/lib/ramadan-date";
import {
  daySchema,
  saveDailyLogSchema,
  createGoalSchema,
  updateGoalSchema,
  createTaskSchema,
  updateTaskSchema,
  deleteSchema,
  createReminderSchema,
  updateReminderSchema,
  updateProfileSchema,
  type ActionResult,
  type DailyLogDTO,
  type PrayerGoalDTO,
  type PlanTaskDTO,
  type ReminderRuleDTO,
  type UserProfileDTO,
} from "@/actions/planner-schemas";

const DEFAULT_TIMEZONE = "Asia/Dhaka";
const DEFAULT_LATITUDE = 23.8103;
const DEFAULT_LONGITUDE = 90.4125;
const DEFAULT_LOCATION_LABEL = "ঢাকা, বাংলাদেশ";

/** Logs the failure server-side (never sent to the client) and returns the generic error string. */
function fail<T>(where: string, error: unknown, code: string): ActionResult<T> {
  console.error(`[planner] ${where} failed`, error instanceof Error ? error.message : error);
  return { ok: false, error: code };
}

const isoDay = (d: Date | null | undefined): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;

/** A YYYY-MM-DD calendar date as the Date Prisma writes to a `date` column (midnight UTC). */
const dateColumn = (dateISO: string) => new Date(`${dateISO}T00:00:00.000Z`);

// ── Daily logs ──────────────────────────────────────────

const dailyLogSelect = {
  id: true,
  day: true,
  prayers: true,
  quranPara: true,
  quranSurah: true,
  quranAyah: true,
  quranPages: true,
  checklist: true,
  journalText: true,
  myDua: true,
  dayTaskDone: true,
} satisfies Prisma.DailyLogSelect;

type DailyLogRow = Prisma.DailyLogGetPayload<{ select: typeof dailyLogSelect }>;

const finiteOr = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function prayersOf(raw: unknown): Record<string, boolean> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, boolean>) : {};
}

function checklistOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}

function normalizeDailyLog(row: DailyLogRow): DailyLogDTO {
  const quranPara = finiteOr(row.quranPara, 0);
  const quranAyah = finiteOr(row.quranAyah, 0);
  const quranPages = finiteOr(row.quranPages, 0);
  return {
    id: String(row.id ?? ""),
    day: finiteOr(row.day, 1),
    prayers: prayersOf(row.prayers),
    quran: {
      para: quranPara > 0 ? String(quranPara) : "",
      surah: typeof row.quranSurah === "string" ? row.quranSurah : "",
      ayah: quranAyah > 0 ? String(quranAyah) : "",
      pages: quranPages > 0 ? String(quranPages) : "",
    },
    checklist: checklistOf(row.checklist),
    journal: {
      reflection: typeof row.journalText === "string" ? row.journalText : "",
      myDua: typeof row.myDua === "string" ? row.myDua : "",
    },
    dayTaskDone: Boolean(row.dayTaskDone),
  };
}

/**
 * The user's local calendar date and the Ramadan (Hijri year) it belongs to. The client sends its local date;
 * without one, today in the profile's time zone is used (never the server's UTC date).
 */
async function resolveLogDate(userId: string, todayISO: string | undefined): Promise<{ logDate: string; ramadanYear: number }> {
  let logDate = todayISO;
  if (!logDate) {
    const profile = await prisma.userProfile.findUnique({ where: { id: userId }, select: { timezone: true } });
    try {
      logDate = todayISOInZone(new Date(), profile?.timezone || DEFAULT_TIMEZONE);
    } catch {
      logDate = todayISOInZone(new Date(), DEFAULT_TIMEZONE);
    }
  }
  return { logDate, ramadanYear: hijriYearForDate(logDate) };
}

const parseCount = (s: string) => Math.max(0, Number.parseInt(s || "0", 10) || 0);

async function upsertDailyLog(
  userId: string,
  payload: z.infer<typeof saveDailyLogSchema>,
): Promise<ActionResult<DailyLogDTO>> {
  try {
    const { logDate, ramadanYear } = await resolveLogDate(userId, payload.logDate);
    const where = { userId_ramadanYear_day: { userId, ramadanYear, day: payload.day } };
    const existing = await prisma.dailyLog.findUnique({ where, select: dailyLogSelect });

    // Fields the payload leaves out keep their stored value.
    const fields = {
      logDate: dateColumn(logDate),
      prayers: (payload.prayers ?? prayersOf(existing?.prayers)) as Prisma.InputJsonValue,
      quranPara: payload.quran ? parseCount(payload.quran.para) : finiteOr(existing?.quranPara, 0),
      quranSurah: payload.quran ? payload.quran.surah.trim() : (existing?.quranSurah ?? ""),
      quranAyah: payload.quran ? parseCount(payload.quran.ayah) : finiteOr(existing?.quranAyah, 0),
      quranPages: payload.quran ? parseCount(payload.quran.pages) : finiteOr(existing?.quranPages, 0),
      checklist: (payload.checklist ?? (Array.isArray(existing?.checklist) ? existing.checklist : [])) as Prisma.InputJsonValue,
      journalText: payload.journal ? payload.journal.reflection : (existing?.journalText ?? ""),
      myDua: payload.journal ? payload.journal.myDua : (existing?.myDua ?? ""),
      dayTaskDone: payload.dayTaskDone ?? existing?.dayTaskDone ?? false,
    };

    const row = await prisma.dailyLog.upsert({
      where,
      create: { userId, ramadanYear, day: payload.day, ...fields },
      update: fields,
      select: dailyLogSelect,
    });
    return { ok: true, data: normalizeDailyLog(row) };
  } catch (error) {
    return fail("saveDailyLog", error, "save_failed");
  }
}

/** `todayISO` (the user's local date) picks the Ramadan year; see resolveLogDate. */
export async function getDailyLogImpl(
  userId: string,
  day: number,
  todayISO?: string,
): Promise<ActionResult<DailyLogDTO | null>> {
  const parsed = daySchema.safeParse(todayISO === undefined ? { day } : { day, date: todayISO });
  if (!parsed.success) {
    return { ok: false, error: "invalid_day" };
  }

  try {
    const { ramadanYear } = await resolveLogDate(userId, parsed.data.date);
    const row = await prisma.dailyLog.findUnique({
      where: { userId_ramadanYear_day: { userId, ramadanYear, day: parsed.data.day } },
      select: dailyLogSelect,
    });
    return { ok: true, data: row ? normalizeDailyLog(row) : null };
  } catch (error) {
    return fail("getDailyLog", error, "load_failed");
  }
}

export async function saveDailyLogImpl(
  userId: string,
  input: z.infer<typeof saveDailyLogSchema>,
): Promise<ActionResult<DailyLogDTO>> {
  const parsed = saveDailyLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  return upsertDailyLog(userId, parsed.data);
}

// ── Prayer goals ────────────────────────────────────────

const goalSelect = {
  id: true,
  title: true,
  targetCount: true,
  targetUnit: true,
  isCompleted: true,
  sortOrder: true,
} satisfies Prisma.PrayerGoalSelect;

function toGoalDTO(row: Prisma.PrayerGoalGetPayload<{ select: typeof goalSelect }>): PrayerGoalDTO {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    targetCount: typeof row.targetCount === "number" ? row.targetCount : 1,
    targetUnit: String(row.targetUnit ?? "times"),
    isCompleted: Boolean(row.isCompleted),
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
  };
}

export async function listPrayerGoalsImpl(
  userId: string,
): Promise<ActionResult<PrayerGoalDTO[]>> {
  try {
    const rows = await prisma.prayerGoal.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: goalSelect,
    });
    return { ok: true, data: rows.map(toGoalDTO) };
  } catch (error) {
    return fail("listPrayerGoals", error, "load_failed");
  }
}

export async function createPrayerGoalImpl(
  userId: string,
  input: z.infer<typeof createGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    const latest = await prisma.prayerGoal.findFirst({
      where: { userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const row = await prisma.prayerGoal.create({
      data: {
        userId,
        title: parsed.data.title,
        targetCount: parsed.data.targetCount,
        targetUnit: parsed.data.targetUnit,
        sortOrder: typeof latest?.sortOrder === "number" ? latest.sortOrder + 1 : 0,
      },
      select: goalSelect,
    });
    return { ok: true, data: toGoalDTO(row) };
  } catch (error) {
    return fail("createPrayerGoal", error, "save_failed");
  }
}

export async function updatePrayerGoalImpl(
  userId: string,
  input: z.infer<typeof updateGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    // id AND user_id: another user's id matches nothing (P2025, reported as save_failed).
    const row = await prisma.prayerGoal.update({
      where: { id: parsed.data.id, userId },
      data: {
        title: parsed.data.title,
        targetCount: parsed.data.targetCount,
        targetUnit: parsed.data.targetUnit,
        isCompleted: parsed.data.isCompleted,
        updatedAt: new Date(),
      },
      select: goalSelect,
    });
    return { ok: true, data: toGoalDTO(row) };
  } catch (error) {
    return fail("updatePrayerGoal", error, "save_failed");
  }
}

export async function deletePrayerGoalImpl(
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    await prisma.prayerGoal.deleteMany({ where: { id: parsed.data.id, userId } });
    return { ok: true, data: null };
  } catch (error) {
    return fail("deletePrayerGoal", error, "delete_failed");
  }
}

// ── Plan tasks ──────────────────────────────────────────

const taskSelect = {
  id: true,
  title: true,
  isDone: true,
  dueDate: true,
  sortOrder: true,
} satisfies Prisma.PlanTaskSelect;

function toTaskDTO(row: Prisma.PlanTaskGetPayload<{ select: typeof taskSelect }>): PlanTaskDTO {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    isDone: Boolean(row.isDone),
    dueDate: isoDay(row.dueDate),
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
  };
}

export async function listPlanTasksImpl(
  userId: string,
): Promise<ActionResult<PlanTaskDTO[]>> {
  try {
    const rows = await prisma.planTask.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: taskSelect,
    });
    return { ok: true, data: rows.map(toTaskDTO) };
  } catch (error) {
    return fail("listPlanTasks", error, "load_failed");
  }
}

export async function createPlanTaskImpl(
  userId: string,
  input: z.infer<typeof createTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    const latest = await prisma.planTask.findFirst({
      where: { userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const row = await prisma.planTask.create({
      data: {
        userId,
        title: parsed.data.title,
        sortOrder: typeof latest?.sortOrder === "number" ? latest.sortOrder + 1 : 0,
      },
      select: taskSelect,
    });
    return { ok: true, data: toTaskDTO(row) };
  } catch (error) {
    return fail("createPlanTask", error, "save_failed");
  }
}

export async function updatePlanTaskImpl(
  userId: string,
  input: z.infer<typeof updateTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const { dueDate } = parsed.data;
  try {
    const row = await prisma.planTask.update({
      where: { id: parsed.data.id, userId },
      data: {
        title: parsed.data.title,
        isDone: parsed.data.isDone,
        ...(dueDate !== undefined ? { dueDate: dueDate === null ? null : dateColumn(dueDate) } : {}),
        updatedAt: new Date(),
      },
      select: taskSelect,
    });
    return { ok: true, data: toTaskDTO(row) };
  } catch (error) {
    return fail("updatePlanTask", error, "save_failed");
  }
}

export async function deletePlanTaskImpl(
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    await prisma.planTask.deleteMany({ where: { id: parsed.data.id, userId } });
    return { ok: true, data: null };
  } catch (error) {
    return fail("deletePlanTask", error, "delete_failed");
  }
}

// ── Reminder rules ──────────────────────────────────────

const reminderSelect = {
  id: true,
  type: true,
  label: true,
  offsetMinutes: true,
  channels: true,
  enabled: true,
} satisfies Prisma.ReminderRuleSelect;

function toReminderDTO(row: Prisma.ReminderRuleGetPayload<{ select: typeof reminderSelect }>): ReminderRuleDTO {
  return {
    id: String(row.id),
    type: (row.type ?? "custom") as ReminderRuleDTO["type"],
    label: String(row.label ?? ""),
    offsetMinutes: typeof row.offsetMinutes === "number" ? row.offsetMinutes : -15,
    channels: Array.isArray(row.channels)
      ? row.channels.filter((c): c is "push" | "calendar" => c === "push" || c === "calendar")
      : ["push"],
    enabled: Boolean(row.enabled),
  };
}

export async function listReminderRulesImpl(
  userId: string,
): Promise<
  ActionResult<ReminderRuleDTO[]>
> {
  try {
    const rows = await prisma.reminderRule.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: reminderSelect,
    });
    return { ok: true, data: rows.map(toReminderDTO) };
  } catch (error) {
    return fail("listReminderRules", error, "load_failed");
  }
}

export async function createReminderRuleImpl(
  userId: string,
  input: z.infer<typeof createReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  const parsed = createReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    const row = await prisma.reminderRule.create({
      data: {
        userId,
        type: parsed.data.type,
        label: parsed.data.label,
        offsetMinutes: parsed.data.offsetMinutes,
        channels: parsed.data.channels,
        enabled: parsed.data.enabled,
      },
      select: reminderSelect,
    });
    return { ok: true, data: toReminderDTO(row) };
  } catch (error) {
    return fail("createReminderRule", error, "save_failed");
  }
}

export async function updateReminderRuleImpl(
  userId: string,
  input: z.infer<typeof updateReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  const parsed = updateReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    const row = await prisma.reminderRule.update({
      where: { id: parsed.data.id, userId },
      data: {
        type: parsed.data.type,
        label: parsed.data.label,
        offsetMinutes: parsed.data.offsetMinutes,
        channels: parsed.data.channels,
        enabled: parsed.data.enabled,
        updatedAt: new Date(),
      },
      select: reminderSelect,
    });
    return { ok: true, data: toReminderDTO(row) };
  } catch (error) {
    return fail("updateReminderRule", error, "save_failed");
  }
}

export async function deleteReminderRuleImpl(
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    await prisma.reminderRule.deleteMany({ where: { id: parsed.data.id, userId } });
    return { ok: true, data: null };
  } catch (error) {
    return fail("deleteReminderRule", error, "delete_failed");
  }
}

// ── User profile ────────────────────────────────────────

const profileSelect = {
  id: true,
  displayName: true,
  locale: true,
  timezone: true,
  latitude: true,
  longitude: true,
  locationLabel: true,
} satisfies Prisma.UserProfileSelect;

function toProfileDTO(row: Prisma.UserProfileGetPayload<{ select: typeof profileSelect }>): UserProfileDTO {
  return {
    id: String(row.id),
    displayName: String(row.displayName ?? ""),
    locale: row.locale === "en" ? "en" : "bn",
    timezone: String(row.timezone ?? DEFAULT_TIMEZONE),
    latitude: typeof row.latitude === "number" ? row.latitude : DEFAULT_LATITUDE,
    longitude: typeof row.longitude === "number" ? row.longitude : DEFAULT_LONGITUDE,
    locationLabel: String(row.locationLabel ?? DEFAULT_LOCATION_LABEL),
  };
}

export async function getUserProfileImpl(
  userId: string,
): Promise<ActionResult<UserProfileDTO>> {
  try {
    const row = await prisma.userProfile.findUnique({ where: { id: userId }, select: profileSelect });
    if (!row) {
      return {
        ok: true,
        data: {
          id: userId,
          displayName: "",
          locale: "bn",
          timezone: DEFAULT_TIMEZONE,
          latitude: DEFAULT_LATITUDE,
          longitude: DEFAULT_LONGITUDE,
          locationLabel: DEFAULT_LOCATION_LABEL,
        },
      };
    }
    return { ok: true, data: toProfileDTO(row) };
  } catch (error) {
    return fail("getUserProfile", error, "load_failed");
  }
}

export async function updateUserProfileImpl(
  userId: string,
  input: z.infer<typeof updateProfileSchema>,
): Promise<ActionResult<UserProfileDTO>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  // latitude/longitude arrive rounded to 2 decimals (updateProfileSchema).
  const fields = {
    displayName: parsed.data.displayName,
    timezone: parsed.data.timezone,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    locationLabel: parsed.data.locationLabel,
  };
  try {
    const row = await prisma.userProfile.upsert({
      where: { id: userId },
      create: { id: userId, ...fields },
      update: fields,
      select: profileSelect,
    });
    return { ok: true, data: toProfileDTO(row) };
  } catch (error) {
    return fail("updateUserProfile", error, "save_failed");
  }
}
