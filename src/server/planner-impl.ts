// Server-only implementations of the planner server functions (src/actions/planner.ts).
// Each xImpl is the old xAction body with the auth preamble replaced by the `userId` parameter, which the
// auth middleware supplies. The service-role client bypasses RLS: every query MUST filter by `userId`.
import "@tanstack/react-start/server-only";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

export async function getDailyLogImpl(
  userId: string,
  day: number,
): Promise<ActionResult<DailyLogDTO | null>> {
  const parsed = daySchema.safeParse({ day });
  if (!parsed.success) {
    return { ok: false, error: "invalid_day" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_logs")
    .select(
      "id,day,prayers,quran_para,quran_surah,quran_ayah,quran_pages,checklist,journal_text,my_dua,day_task_done",
    )
    .eq("user_id", userId)
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

export async function listPrayerGoalsImpl(
  userId: string,
): Promise<ActionResult<PrayerGoalDTO[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_goals")
    .select("id,title,target_count,target_unit,is_completed,sort_order")
    .eq("user_id", userId)
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

export async function createPrayerGoalImpl(
  userId: string,
  input: z.infer<typeof createGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("prayer_goals")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    latest && typeof latest.sort_order === "number" ? latest.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("prayer_goals")
    .insert({
      user_id: userId,
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

export async function updatePrayerGoalImpl(
  userId: string,
  input: z.infer<typeof updateGoalSchema>,
): Promise<ActionResult<PrayerGoalDTO>> {
  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

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
    .eq("user_id", userId)
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

export async function deletePrayerGoalImpl(
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prayer_goals")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true, data: null };
}

export async function listPlanTasksImpl(
  userId: string,
): Promise<ActionResult<PlanTaskDTO[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_tasks")
    .select("id,title,is_done,due_date,sort_order")
    .eq("user_id", userId)
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

export async function createPlanTaskImpl(
  userId: string,
  input: z.infer<typeof createTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("plan_tasks")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    latest && typeof latest.sort_order === "number" ? latest.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("plan_tasks")
    .insert({
      user_id: userId,
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

export async function updatePlanTaskImpl(
  userId: string,
  input: z.infer<typeof updateTaskSchema>,
): Promise<ActionResult<PlanTaskDTO>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_tasks")
    .update({
      title: parsed.data.title,
      is_done: parsed.data.isDone,
      ...(parsed.data.dueDate !== undefined ? { due_date: parsed.data.dueDate } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
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

export async function deletePlanTaskImpl(
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_tasks")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true, data: null };
}

export async function listReminderRulesImpl(
  userId: string,
): Promise<
  ActionResult<ReminderRuleDTO[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("id,type,label,offset_minutes,channels,enabled")
    .eq("user_id", userId)
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

export async function createReminderRuleImpl(
  userId: string,
  input: z.infer<typeof createReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  const parsed = createReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .insert({
      user_id: userId,
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

export async function updateReminderRuleImpl(
  userId: string,
  input: z.infer<typeof updateReminderSchema>,
): Promise<ActionResult<ReminderRuleDTO>> {
  const parsed = updateReminderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

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
    .eq("user_id", userId)
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

export async function deleteReminderRuleImpl(
  userId: string,
  id: string,
): Promise<ActionResult<null>> {
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reminder_rules")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true, data: null };
}

export async function getUserProfileImpl(
  userId: string,
): Promise<ActionResult<UserProfileDTO>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,display_name,locale,timezone,latitude,longitude,location_label")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "load_failed" };
  }

  if (!data) {
    return {
      ok: true,
      data: {
        id: userId,
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

export async function updateUserProfileImpl(
  userId: string,
  input: z.infer<typeof updateProfileSchema>,
): Promise<ActionResult<UserProfileDTO>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: userId,
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
