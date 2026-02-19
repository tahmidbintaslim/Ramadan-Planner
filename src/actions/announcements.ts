"use server";

import { z } from "zod";
import type { Announcement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/admin";

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

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  titleBn: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200),
  bodyBn: z.string().trim().min(1),
  bodyEn: z.string().trim(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
});

const deleteSchema = z.object({ id: z.string().uuid() });

async function requireAdmin(): Promise<
  AnnouncementResult<{ userId: string; email: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return { ok: false, error: "unauthorized" };
  }

  const admin = await isUserAdmin({ userId: user.id, email: user.email });
  if (!admin) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: true, data: { userId: user.id, email: user.email } };
}

function normalizeAnnouncement(row: Announcement): AnnouncementDTO {
  return {
    id: row.id,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    bodyBn: row.bodyBn,
    bodyEn: row.bodyEn,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt ? row.endAt.toISOString() : null,
  };
}

export async function listActiveAnnouncementsAction(): Promise<
  AnnouncementResult<AnnouncementDTO[]>
> {
  const now = new Date();

  const rows = await prisma.announcement.findMany({
    where: {
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gte: now } }],
    },
    orderBy: [{ startAt: "desc" }],
  });

  return { ok: true, data: rows.map((item) => normalizeAnnouncement(item)) };
}

export async function listAdminAnnouncementsAction(): Promise<
  AnnouncementResult<AnnouncementDTO[]>
> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const rows = await prisma.announcement.findMany({
    orderBy: [{ startAt: "desc" }],
  });

  return { ok: true, data: rows.map((item) => normalizeAnnouncement(item)) };
}

export async function saveAnnouncementAction(
  input: z.infer<typeof saveSchema>,
): Promise<AnnouncementResult<AnnouncementDTO>> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const payload = parsed.data;
  const row = payload.id
    ? await prisma.announcement.update({
        where: { id: payload.id },
        data: {
          titleBn: payload.titleBn,
          titleEn: payload.titleEn,
          bodyBn: payload.bodyBn,
          bodyEn: payload.bodyEn,
          startAt: new Date(payload.startAt),
          endAt: payload.endAt ? new Date(payload.endAt) : null,
        },
      })
    : await prisma.announcement.create({
        data: {
          titleBn: payload.titleBn,
          titleEn: payload.titleEn,
          bodyBn: payload.bodyBn,
          bodyEn: payload.bodyEn,
          startAt: new Date(payload.startAt),
          endAt: payload.endAt ? new Date(payload.endAt) : null,
        },
      });

  return { ok: true, data: normalizeAnnouncement(row) };
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<AnnouncementResult<null>> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  await prisma.announcement.delete({ where: { id: parsed.data.id } });
  return { ok: true, data: null };
}
