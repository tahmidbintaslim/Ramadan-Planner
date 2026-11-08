// Types and zod schemas shared by the planner server functions (src/actions/planner.ts) and their
// server-side implementations (src/server/planner-impl.ts). Pure: safe to import from client code.
import { z } from "zod";
import { isValidTimeZone } from "@/lib/user-location";

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

const coarse2 = (value: number) => Math.round(value * 100) / 100;

export const daySchema = z.object({
  day: z.number().int().min(1).max(30),
  /** The user's local calendar date (YYYY-MM-DD): picks the Ramadan (Hijri year) the day belongs to. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** The prayers the salah tracker records: the five daily prayers plus taraweeh and tahajjud. */
export const TRACKED_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha", "taraweeh", "tahajjud"] as const;

export const JOURNAL_MAX = 5000;
export const CHECKLIST_MAX_ITEMS = 50;
export const CHECKLIST_ITEM_MAX = 200;
export const QURAN_FIELD_MAX = 500;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const saveDailyLogSchema = z.object({
  day: z.number().int().min(1).max(30),
  /** The user's local calendar date (YYYY-MM-DD) the save belongs to; the server falls back to the profile zone. */
  logDate: z.string().regex(ISO_DATE).optional(),
  prayers: z.partialRecord(z.enum(TRACKED_PRAYERS), z.boolean()).optional(),
  quran: z
    .object({
      para: z.string().max(QURAN_FIELD_MAX),
      surah: z.string().max(QURAN_FIELD_MAX),
      ayah: z.string().max(QURAN_FIELD_MAX),
      pages: z.string().max(QURAN_FIELD_MAX),
    })
    .optional(),
  checklist: z.array(z.string().max(CHECKLIST_ITEM_MAX)).max(CHECKLIST_MAX_ITEMS).optional(),
  journal: z
    .object({
      reflection: z.string().max(JOURNAL_MAX),
      myDua: z.string().max(JOURNAL_MAX),
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
  /** The plan uses it as the day the done state belongs to (YYYY-MM-DD); omitted = unchanged. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
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
  // A real IANA zone: the push dispatcher formats dates in it.
  timezone: z.string().trim().refine(isValidTimeZone, "invalid time zone"),
  locationLabel: z.string().trim().min(1).max(180),
  // Rounded to 2 decimals (about 1 km): enough for prayer times, and no precise position is stored.
  latitude: z.number().min(-90).max(90).transform(coarse2),
  longitude: z.number().min(-180).max(180).transform(coarse2),
});
