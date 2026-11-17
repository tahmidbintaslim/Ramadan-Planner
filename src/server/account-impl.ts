// Server-only bodies of the account server functions (src/actions/account.ts): "export my data" and
// "delete my account" (issue #52, and both app stores require in-app account deletion). Every query is keyed by
// the `userId` the auth middleware supplies, never by anything the client sends.
import "@tanstack/react-start/server-only";

import { clerkClient } from "@clerk/tanstack-react-start/server";
import { prisma } from "@/lib/prisma";
import type { AccountResult } from "@/actions/account-schemas";

/**
 * Every row the user owns. Secrets are left out: the encrypted Google tokens and the ICS secret hash are
 * reported only as flags, and push keys (which the browser can recreate) are dropped. Returned as JSON text, ready
 * to save as a file.
 */
export async function exportAccountDataImpl(userId: string): Promise<AccountResult<string>> {
  const where = { userId };
  const [profile, prayerGoals, planTasks, dailyLogs, reminderRules, pushSubscriptions, calendarLink, usageEvents] =
    await Promise.all([
      prisma.userProfile.findUnique({ where: { id: userId } }),
      prisma.prayerGoal.findMany({ where }),
      prisma.planTask.findMany({ where }),
      prisma.dailyLog.findMany({ where, orderBy: { logDate: "asc" } }),
      prisma.reminderRule.findMany({ where }),
      prisma.pushSubscription.findMany({ where, select: { id: true, endpoint: true, createdAt: true } }),
      prisma.calendarLink.findUnique({
        where,
        select: { googleTokens: true, icsSecretHash: true, createdAt: true, updatedAt: true },
      }),
      prisma.usageEvent.findMany({ where, select: { at: true, name: true, path: true, locale: true } }),
    ]);

  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    prayerGoals,
    planTasks,
    dailyLogs,
    reminderRules,
    pushSubscriptions,
    calendar: calendarLink
      ? {
          googleCalendarConnected: calendarLink.googleTokens !== null,
          icsFeedActive: calendarLink.icsSecretHash !== null,
          createdAt: calendarLink.createdAt,
          updatedAt: calendarLink.updatedAt,
        }
      : null,
    usageEvents,
  };
  return { ok: true, data: JSON.stringify(data, null, 2) };
}

/**
 * Deletes the user's data, then their Clerk account. The data goes first: if Clerk then fails, the user is told to
 * retry and can still sign in to do so, whereas the other order could leave data behind with no account to remove it.
 * `user_profiles` cascades to goals, tasks, daily logs, reminder rules, push subscriptions and the calendar link;
 * push delivery logs and usage events have no cascade from it, so they are removed explicitly.
 */
export async function deleteAccountImpl(userId: string, clerkId: string): Promise<AccountResult<null>> {
  await prisma.$transaction([
    prisma.pushDeliveryLog.deleteMany({ where: { userId } }),
    prisma.usageEvent.deleteMany({ where: { userId } }),
    prisma.adminUser.deleteMany({ where: { userId } }),
    prisma.userProfile.deleteMany({ where: { id: userId } }),
  ]);
  try {
    await clerkClient().users.deleteUser(clerkId);
  } catch (error) {
    console.error("[deleteAccount] data deleted but Clerk user deletion failed", error);
    return { ok: false, error: "auth_delete_failed" };
  }
  return { ok: true, data: null };
}
