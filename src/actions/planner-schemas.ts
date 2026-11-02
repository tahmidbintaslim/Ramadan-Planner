// Types and zod schemas shared by the planner server functions (src/actions/planner.ts) and their
// server-side implementations (src/server/planner-impl.ts). Pure: safe to import from client code.
import { z } from "zod";

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

export const REMINDER_TYPES = [
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

export const daySchema = z.object({
  day: z.number().int().min(1).max(30),
});

export const saveDailyLogSchema = z.object({
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

export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(140),
  targetCount: z.number().int().min(1).max(1000),
  targetUnit: z.string().trim().min(1).max(40),
});

export const updateGoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  targetCount: z.number().int().min(1).max(1000),
  targetUnit: z.string().trim().min(1).max(40),
  isCompleted: z.boolean(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(180),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  isDone: z.boolean(),
});

export const deleteSchema = z.object({
  id: z.string().uuid(),
});

export const createReminderSchema = z.object({
  type: z.enum(REMINDER_TYPES),
  label: z.string().trim().max(120),
  offsetMinutes: z.number().int().min(-720).max(720),
  channels: z.array(z.enum(["push", "calendar"]))
    .min(1)
    .max(2),
  enabled: z.boolean(),
});

export const updateReminderSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(REMINDER_TYPES),
  label: z.string().trim().max(120),
  offsetMinutes: z.number().int().min(-720).max(720),
  channels: z.array(z.enum(["push", "calendar"]))
    .min(1)
    .max(2),
  enabled: z.boolean(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().max(120),
  timezone: z.string().trim().min(1).max(120),
  locationLabel: z.string().trim().min(1).max(180),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
