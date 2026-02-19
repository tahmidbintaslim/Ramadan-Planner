"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isUserAdmin } from "@/lib/admin";

export type AdminUsersResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const addSchema = z.object({ userId: z.string().uuid() });
const removeSchema = z.object({ userId: z.string().uuid() });

async function requireAdmin(): Promise<
  AdminUsersResult<{ userId: string; email: string | null }>
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, error: "unauthorized" };
  }

  const allowed = await isUserAdmin({ userId: user.id, email: user.email });
  if (!allowed) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: true, data: { userId: user.id, email: user.email ?? null } };
}

export async function listAdminUsersAction(): Promise<
  AdminUsersResult<Array<{ userId: string; createdAt: string }>>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const rows = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { userId: true, createdAt: true },
  });

  return {
    ok: true,
    data: rows.map((row) => ({
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function addAdminUserAction(
  userId: string,
): Promise<AdminUsersResult<{ userId: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = addSchema.safeParse({ userId });
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

export async function removeAdminUserAction(
  userId: string,
): Promise<AdminUsersResult<null>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = removeSchema.safeParse({ userId });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  if (parsed.data.userId === auth.data.userId) {
    return { ok: false, error: "cannot_remove_self" };
  }

  await prisma.adminUser.deleteMany({ where: { userId: parsed.data.userId } });
  return { ok: true, data: null };
}
