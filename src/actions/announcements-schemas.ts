// Types and schemas shared by the announcements server functions (client-safe: no server imports).
import { z } from "zod";

export interface AnnouncementDTO {
  id: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  startAt: string;
  endAt: string | null;
}

export type AnnouncementResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const saveSchema = z.object({
  id: z.string().uuid().optional(),
  titleBn: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200),
  bodyBn: z.string().trim().min(1).max(4000),
  bodyEn: z.string().trim().max(4000),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
});

export const deleteSchema = z.object({ id: z.string().uuid() });

export type SaveAnnouncementInput = z.infer<typeof saveSchema>;
