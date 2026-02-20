"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppAuthUser } from "@/lib/auth/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface DailyLogDTO {
  id: string;
  day: number;
  prayers: Record<string, boolean>;
  quran: {
    para: string;
    surah: string;
    ayah: string;
    pages: string;
  };
  checklist: string[];
  journal: {
    reflection: string;
    myDua: string;
  };
  dayTaskDone: boolean;
}

export interface PrayerGoalDTO {
  id: string;
  title: string;
  targetCount: number;
  targetUnit: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface PlanTaskDTO {
  id: string;
  title: string;
  isDone: boolean;
  dueDate: string | null;
  sortOrder: number;
}

const REMINDER_TYPES = [
  "sehri",
  "iftar",
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "taraweeh",
  "tahajjud",
  "custom",
] as const;

export interface ReminderRuleDTO {
  id: string;
  type: (typeof REMINDER_TYPES)[number];
  label: string;
  offsetMinutes: number;
  channels: Array<"push" | "calendar">;
  enabled: boolean;
}

export interface UserProfileDTO {
  id: string;
  displayName: string;
  locale: "bn" | "en";
  timezone: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
}

const daySchema = z.object({
  day: z.number().int().min(1).max(30),
});

const saveDailyLogSchema = z.object({
  day: z.number().int().min(1).max(30),
  prayers: z.record(z.string(), z.boolean()).optional(),
  quran: z
    .object({
      para: z.string(),
      surah: z.string(),
      ayah: z.string(),
      pages: z.string(),
    })
    .optional(),
  checklist: z.array(z.string()).optional(),
  journal: z
    .object({
      reflection: z.string(),
      myDua: z.string(),
    })
    .optional(),
  dayTaskDone: z.boolean().optional(),
});

const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(140),
  targetCount: z.number().int().min(1).max(1000),
  targetUnit: z.string().trim().min(1).max(40),
});

const updateGoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  targetCount: z.number().int().min(1).max(1000),
  targetUnit: z.string().trim().min(1).max(40),
  isCompleted: z.boolean(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(180),
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  isDone: z.boolean(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

const createReminderSchema = z.object({
  type: z.enum(REMINDER_TYPES),
  label: z.string().trim().max(120),
  offsetMinutes: z.number().int().min(-720).max(720),
  channels: z.array(z.enum(["push", "calendar"]))
    .min(1)
    .max(2),
  enabled: z.boolean(),
});

const updateReminderSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(REMINDER_TYPES),
  label: z.string().trim().max(120),
  offsetMinutes: z.number().int().min(-720).max(720),
  channels: z.array(z.enum(["push", "calendar"]))
    .min(1)
    .max(2),
  enabled: z.boolean(),
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().max(120),
  timezone: z.string().trim().min(1).max(120),
  locationLabel: z.string().trim().min(1).max(180),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

async function requireUserId(): Promise<ActionResult<string>> {
  const user = await getAppAuthUser({ ensureProfile: true });
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }

  return { ok: true, data: user.id };
}

function normalizeDailyLog(row: Record<string, unknown>): DailyLogDTO {
  const prayersRaw = row.prayers;
  const prayers =
    typeof prayersRaw === "object" && prayersRaw !== null
      ? (prayersRaw as Record<string, boolean>)
      : {};

  const checklistRaw = row.checklist;
  const checklist = Array.isArray(checklistRaw)
    ? checklistRaw.filter((item): item is string => typeof item === "string")
    : [];

  const quranPara =
    typeof row.quran_para === "number" && Number.isFinite(row.quran_para)
      ? row.quran_para
      : 0;
  const quranAyah =
    typeof row.quran_ayah === "number" && Number.isFinite(row.quran_ayah)
      ? row.quran_ayah
      : 0;
  const quranPages =
    typeof row.quran_pages === "number" && Number.isFinite(row.quran_pages)
      ? row.quran_pages
      : 0;

  return {
    id: String(row.id ?? ""),
    day:
      typeof row.day === "number" && Number.isFinite(row.day) ? row.day : 1,
    prayers,
    quran: {
      para: quranPara > 0 ? String(quranPara) : "",
      surah: typeof row.quran_surah === "string" ? row.quran_surah : "",
      ayah: quranAyah > 0 ? String(quranAyah) : "",
      pages: quranPages > 0 ? String(quranPages) : "",
    },
    checklist,
    journal: {
      reflection:
        typeof row.journal_text === "string" ? row.journal_text : "",
      myDua: typeof row.my_dua === "string" ? row.my_dua : "",
    },
    dayTaskDone: Boolean(row.day_task_done),
  };
}

async function upsertDailyLog(
  userId: string,
  payload: z.infer<typeof saveDailyLogSchema>,
): Promise<ActionResult<DailyLogDTO>> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("daily_logs")
    .select(
      "id,day,prayers,quran_para,quran_surah,quran_ayah,quran_pages,checklist,journal_text,my_dua,day_task_done",
    )
    .eq("user_id", userId)
    .eq("day", payload.day)
    .maybeSingle();

  const existingRow =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : null;

  const nextPrayers = payload.prayers ??
    (existingRow?.prayers as Record<string, boolean> | undefined) ?? {};
  const nextChecklist = payload.checklist ??
    (Array.isArray(existingRow?.checklist)
      ? (existingRow?.checklist as string[])
      : []);

  const existingPara =
    typeof existingRow?.quran_para === "number" ? existingRow.quran_para : 0;
  const existingAyah =
    typeof existingRow?.quran_ayah === "number" ? existingRow.quran_ayah : 0;
  const existingPages =
    typeof existingRow?.quran_pages === "number" ? existingRow.quran_pages : 0;

  const para = payload.quran
    ? Math.max(0, Number.parseInt(payload.quran.para || "0", 10) || 0)
    : existingPara;
  const ayah = payload.quran
    ? Math.max(0, Number.parseInt(payload.quran.ayah || "0", 10) || 0)
    : existingAyah;
  const pages = payload.quran
    ? Math.max(0, Number.parseInt(payload.quran.pages || "0", 10) || 0)
    : existingPages;

  const quranSurah = payload.quran
    ? payload.quran.surah.trim()
    : typeof existingRow?.quran_surah === "string"
      ? existingRow.quran_surah
      : "";

  const reflection = payload.journal
    ? payload.journal.reflection
    : typeof existingRow?.journal_text === "string"
      ? existingRow.journal_text
      : "";

  const myDua = payload.journal
    ? payload.journal.myDua
    : typeof existingRow?.my_dua === "string"
      ? existingRow.my_dua
      : "";

  const dayTaskDone =
    payload.dayTaskDone ??
    (typeof existingRow?.day_task_done === "boolean"
      ? existingRow.day_task_done
      : false);

  const { data, error } = await supabase
    .from("daily_logs")
    .upsert(
      {
        user_id: userId,
        day: payload.day,
        log_date: new Date().toISOString().slice(0, 10),
        prayers: nextPrayers,
        quran_para: para,
        quran_surah: quranSurah,
        quran_ayah: ayah,
        quran_pages: pages,
        checklist: nextChecklist,
        journal_text: reflection,
        my_dua: myDua,
        day_task_done: dayTaskDone,
      },
      { onConflict: "user_id,day" },
    )
    .select(
      "id,day,prayers,quran_para,quran_surah,quran_ayah,quran_pages,checklist,journal_text,my_dua,day_task_done",
    )
    .single();

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, data: normalizeDailyLog(data as Record<string, unknown>) };
}

export async function getDailyLogAction(
  day: number,
): Promise<ActionResult<DailyLogDTO | null>> {
  const parsed = daySchema.safeParse({ day });
  if (!parsed.success) {
    return { ok: false, error: "invalid_day" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_logs")
    .select(
      "id,day,prayers,quran_para,quran_surah,quran_ayah,quran_pages,checklist,journal_text,my_dua,day_task_done",
    )
    .eq("user_id", auth.data)
    .eq("day", parsed.data.day)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "load_failed" };
  }

  if (!data || typeof data !== "object") {
    return { ok: true, data: null };
  }

  return { ok: true, data: normalizeDailyLog(data as Record<string, unknown>) };
}

export async function saveDailyLogAction(
  input: z.infer<typeof saveDailyLogSchema>,
): Promise<ActionResult<DailyLogDTO>> {
  const parsed = saveDailyLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  return upsertDailyLog(auth.data, parsed.data);
}

export async function listPrayerGoalsAction(): Promise<ActionResult<PrayerGoalDTO[]>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_goals")
    .select("id,title,target_count,target_unit,is_completed,sort_order")
    .eq("user_id", auth.data)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return { ok: false, error: "load_failed" };
  }

  return {
    ok: true,
    data: data.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      targetCount:
        typeof row.target_count === "number" ? row.target_count : 1,
      targetUnit: String(row.target_unit ?? "times"),
      isCompleted: Boolean(row.is_completed),
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    })),
  };
}

export async function createPrayerGoalAction(
  input: z.infer<typeof createGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("prayer_goals")
    .select("sort_order")
    .eq("user_id", auth.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    latest && typeof latest.sort_order === "number" ? latest.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("prayer_goals")
    .insert({
      user_id: auth.data,
      title: parsed.data.title,
      target_count: parsed.data.targetCount,
      target_unit: parsed.data.targetUnit,
      sort_order: sortOrder,
    })
    .select("id,title,target_count,target_unit,is_completed,sort_order")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      title: String(data.title ?? ""),
      targetCount:
        typeof data.target_count === "number" ? data.target_count : 1,
      targetUnit: String(data.target_unit ?? "times"),
      isCompleted: Boolean(data.is_completed),
      sortOrder: typeof data.sort_order === "number" ? data.sort_order : 0,
    },
  };
}

export async function updatePrayerGoalAction(
  input: z.infer<typeof updateGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_goals")
    .update({
      title: parsed.data.title,
      target_count: parsed.data.targetCount,
      target_unit: parsed.data.targetUnit,
      is_completed: parsed.data.isCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", auth.data)
    .select("id,title,target_count,target_unit,is_completed,sort_order")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      title: String(data.title ?? ""),
      targetCount:
        typeof data.target_count === "number" ? data.target_count : 1,
      targetUnit: String(data.target_unit ?? "times"),
      isCompleted: Boolean(data.is_completed),
      sortOrder: typeof data.sort_order === "number" ? data.sort_order : 0,
    },
  };
}

export async function deletePrayerGoalAction(
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("prayer_goals")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.data);

  if (error) {
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true, data: null };
}

export async function listPlanTasksAction(): Promise<ActionResult<PlanTaskDTO[]>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_tasks")
    .select("id,title,is_done,due_date,sort_order")
    .eq("user_id", auth.data)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return { ok: false, error: "load_failed" };
  }

  return {
    ok: true,
    data: data.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      isDone: Boolean(row.is_done),
      dueDate: typeof row.due_date === "string" ? row.due_date : null,
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    })),
  };
}

export async function createPlanTaskAction(
  input: z.infer<typeof createTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("plan_tasks")
    .select("sort_order")
    .eq("user_id", auth.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    latest && typeof latest.sort_order === "number" ? latest.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("plan_tasks")
    .insert({
      user_id: auth.data,
      title: parsed.data.title,
      sort_order: sortOrder,
    })
    .select("id,title,is_done,due_date,sort_order")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      title: String(data.title ?? ""),
      isDone: Boolean(data.is_done),
      dueDate: typeof data.due_date === "string" ? data.due_date : null,
      sortOrder: typeof data.sort_order === "number" ? data.sort_order : 0,
    },
  };
}

export async function updatePlanTaskAction(
  input: z.infer<typeof updateTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_tasks")
    .update({
      title: parsed.data.title,
      is_done: parsed.data.isDone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", auth.data)
    .select("id,title,is_done,due_date,sort_order")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      title: String(data.title ?? ""),
      isDone: Boolean(data.is_done),
      dueDate: typeof data.due_date === "string" ? data.due_date : null,
      sortOrder: typeof data.sort_order === "number" ? data.sort_order : 0,
    },
  };
}

export async function deletePlanTaskAction(
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_tasks")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.data);

  if (error) {
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true, data: null };
}

export async function listReminderRulesAction(): Promise<
  ActionResult<ReminderRuleDTO[]>
> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("id,type,label,offset_minutes,channels,enabled")
    .eq("user_id", auth.data)
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return { ok: false, error: "load_failed" };
  }

  return {
    ok: true,
    data: data.map((row) => ({
      id: String(row.id),
      type: (row.type ?? "custom") as ReminderRuleDTO["type"],
      label: String(row.label ?? ""),
      offsetMinutes:
        typeof row.offset_minutes === "number" ? row.offset_minutes : -15,
      channels: Array.isArray(row.channels)
        ? row.channels.filter(
            (c): c is "push" | "calendar" =>
              c === "push" || c === "calendar",
          )
        : ["push"],
      enabled: Boolean(row.enabled),
    })),
  };
}

export async function createReminderRuleAction(
  input: z.infer<typeof createReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  const parsed = createReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .insert({
      user_id: auth.data,
      type: parsed.data.type,
      label: parsed.data.label,
      offset_minutes: parsed.data.offsetMinutes,
      channels: parsed.data.channels,
      enabled: parsed.data.enabled,
    })
    .select("id,type,label,offset_minutes,channels,enabled")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      type: (data.type ?? "custom") as ReminderRuleDTO["type"],
      label: String(data.label ?? ""),
      offsetMinutes:
        typeof data.offset_minutes === "number" ? data.offset_minutes : -15,
      channels: Array.isArray(data.channels)
        ? data.channels.filter(
            (c): c is "push" | "calendar" =>
              c === "push" || c === "calendar",
          )
        : ["push"],
      enabled: Boolean(data.enabled),
    },
  };
}

export async function updateReminderRuleAction(
  input: z.infer<typeof updateReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  const parsed = updateReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .update({
      type: parsed.data.type,
      label: parsed.data.label,
      offset_minutes: parsed.data.offsetMinutes,
      channels: parsed.data.channels,
      enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", auth.data)
    .select("id,type,label,offset_minutes,channels,enabled")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      type: (data.type ?? "custom") as ReminderRuleDTO["type"],
      label: String(data.label ?? ""),
      offsetMinutes:
        typeof data.offset_minutes === "number" ? data.offset_minutes : -15,
      channels: Array.isArray(data.channels)
        ? data.channels.filter(
            (c): c is "push" | "calendar" =>
              c === "push" || c === "calendar",
          )
        : ["push"],
      enabled: Boolean(data.enabled),
    },
  };
}

export async function deleteReminderRuleAction(
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("reminder_rules")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.data);

  if (error) {
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true, data: null };
}

export async function getUserProfileAction(): Promise<ActionResult<UserProfileDTO>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,display_name,locale,timezone,latitude,longitude,location_label")
    .eq("id", auth.data)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "load_failed" };
  }

  if (!data) {
    return {
      ok: true,
      data: {
        id: auth.data,
        displayName: "",
        locale: "bn",
        timezone: "Asia/Dhaka",
        latitude: 23.8103,
        longitude: 90.4125,
        locationLabel: "ঢাকা, বাংলাদেশ",
      },
    };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      displayName: String(data.display_name ?? ""),
      locale: data.locale === "en" ? "en" : "bn",
      timezone: String(data.timezone ?? "Asia/Dhaka"),
      latitude: typeof data.latitude === "number" ? data.latitude : 23.8103,
      longitude: typeof data.longitude === "number" ? data.longitude : 90.4125,
      locationLabel: String(data.location_label ?? "ঢাকা, বাংলাদেশ"),
    },
  };
}

export async function updateUserProfileAction(
  input: z.infer<typeof updateProfileSchema>,
): Promise<ActionResult<UserProfileDTO>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const auth = await requireUserId();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: auth.data,
        display_name: parsed.data.displayName,
        timezone: parsed.data.timezone,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        location_label: parsed.data.locationLabel,
      },
      { onConflict: "id" },
    )
    .select("id,display_name,locale,timezone,latitude,longitude,location_label")
    .single();

  if (error || !data) {
    return { ok: false, error: "save_failed" };
  }

  return {
    ok: true,
    data: {
      id: String(data.id),
      displayName: String(data.display_name ?? ""),
      locale: data.locale === "en" ? "en" : "bn",
      timezone: String(data.timezone ?? "Asia/Dhaka"),
      latitude: typeof data.latitude === "number" ? data.latitude : 23.8103,
      longitude: typeof data.longitude === "number" ? data.longitude : 90.4125,
      locationLabel: String(data.location_label ?? "ঢাকা, বাংলাদেশ"),
    },
  };
}
