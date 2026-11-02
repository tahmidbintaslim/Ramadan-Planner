// Server-only implementations of the admin-users server functions (src/actions/admin-users.ts).
// Admin rights (Prisma AdminUser row or ADMIN_EMAILS) are checked HERE on every call.
import "@tanstack/react-start/server-only";
import { prisma } from "@/lib/prisma";
import { isUserAdmin } from "@/lib/admin";
import { getCallerWithEmail } from "@/server/caller";
import { getAppAuthUser } from "@/lib/auth/server";
import {
  addSchema,
  removeSchema,
  type AdminUsersResult,
} from "@/actions/admin-users-schemas";

async function requireAdmin(
  userId: string,
): Promise<AdminUsersResult<{ userId: string; email: string | null }>> {
  // The auth middleware does not look the email up; ADMIN_EMAILS needs it, so fetch it here.
  const user = await getCallerWithEmail(userId);
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }

  const allowed = await isUserAdmin({ userId: user.id, email: user.email });
  if (!allowed) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: true, data: { userId: user.id, email: user.email } };
}

export async function listAdminUsersImpl(
  userId: string,
): Promise<AdminUsersResult<Array<{ userId: string; createdAt: string }>>> {
  const auth = await requireAdmin(userId);
  if (!auth.ok) return auth;

  const rows = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { userId: true, createdAt: true },
  });

  return {
    ok: true,
    data: rows.map((row) => ({
      userId: row.userId,
      createdAt: row.createdAt ? row.createdAt.toISOString() : "",
    })),
  };
}

/** `targetUserId` is checked against the schema after the admin check (the old order). */
export async function addAdminUserImpl(
  userId: string,
  targetUserId: string,
): Promise<AdminUsersResult<{ userId: string }>> {
  const auth = await requireAdmin(userId);
  if (!auth.ok) return auth;

  const parsed = addSchema.safeParse({ userId: targetUserId });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });

  if (!profile) {
    return { ok: false, error: "user_not_found" };
  }

  await prisma.adminUser.upsert({
    where: { userId: parsed.data.userId },
    create: { userId: parsed.data.userId },
    update: {},
  });

  return { ok: true, data: { userId: parsed.data.userId } };
}

export async function removeAdminUserImpl(
  userId: string,
  targetUserId: string,
): Promise<AdminUsersResult<null>> {
  const auth = await requireAdmin(userId);
  if (!auth.ok) return auth;

  const parsed = removeSchema.safeParse({ userId: targetUserId });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  if (parsed.data.userId === auth.data.userId) {
    return { ok: false, error: "cannot_remove_self" };
  }

  await prisma.adminUser.deleteMany({ where: { userId: parsed.data.userId } });
  return { ok: true, data: null };
}

export type AdminAccess = "ok" | "unauthorized" | "forbidden";

/** Page gate for /admin/announcements: signed out, signed in but not an admin, or an admin. */
export async function getAdminAccessImpl(): Promise<AdminAccess> {
  const user = await getAppAuthUser({ withEmail: true });
  if (!user) return "unauthorized";
  return (await isUserAdmin({ userId: user.id, email: user.email })) ? "ok" : "forbidden";
}
