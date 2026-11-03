// Server-only implementations of the announcements server functions (src/actions/announcements.ts).
// Plain functions with no server-function wrapper dependency: the Next-era route handlers under
// src/app/api/announcements/** (ported in Task 8) call them directly.
//   - listActiveAnnouncementsImpl is PUBLIC (no user, no auth), as the old action and GET /api/announcements were.
//   - the others take the caller's `userId` (supplied by the auth middleware, or by the route handler's own
//     session check) and check admin rights HERE on every call.
import "@tanstack/react-start/server-only";
import type { Announcement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUserAdmin } from "@/lib/admin";
import { getCallerWithEmail } from "@/server/caller";
import {
  deleteSchema,
  saveSchema,
  type AnnouncementDTO,
  type AnnouncementResult,
} from "@/actions/announcements-schemas";

async function requireAdmin(
  userId: string,
): Promise<AnnouncementResult<{ userId: string; email: string }>> {
  // The auth middleware does not look the email up; ADMIN_EMAILS needs it, so fetch it here.
  const user = await getCallerWithEmail(userId);
  if (!user || !user.email) {
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

/** PUBLIC: no authentication, same as before. */
export async function listActiveAnnouncementsImpl(): Promise<
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

export async function listAdminAnnouncementsImpl(
  userId: string,
): Promise<AnnouncementResult<AnnouncementDTO[]>> {
  const admin = await requireAdmin(userId);
  if (!admin.ok) return admin;

  const rows = await prisma.announcement.findMany({
    orderBy: [{ startAt: "desc" }],
  });

  return { ok: true, data: rows.map((item) => normalizeAnnouncement(item)) };
}

/** `input` is unknown on purpose: admin rights are checked first, then the schema (the old order). */
export async function saveAnnouncementImpl(
  userId: string,
  input: unknown,
): Promise<AnnouncementResult<AnnouncementDTO>> {
  const admin = await requireAdmin(userId);
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

export async function deleteAnnouncementImpl(
  userId: string,
  id: string,
): Promise<AnnouncementResult<null>> {
  const admin = await requireAdmin(userId);
  if (!admin.ok) return admin;

  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  await prisma.announcement.delete({ where: { id: parsed.data.id } });
  return { ok: true, data: null };
}
