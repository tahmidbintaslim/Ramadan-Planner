// Server-only: Start's import protection fails the client build if this module reaches a client bundle.
import "@tanstack/react-start/server-only";
import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { prisma } from "@/lib/prisma";
import { clerkIdToUuid } from "./uuid";

export { clerkIdToUuid };

export interface AppAuthUser {
  id: string;
  clerkId: string;
  email: string | null;
}

export async function getAppAuthUser(options?: {
  ensureProfile?: boolean;
  /**
   * Look up the email with the Clerk Backend API (default true, the original behavior).
   * Pass false when the email is not needed (e.g. the per-call auth middleware): `email` is then null
   * and no Clerk Backend request is made.
   */
  withEmail?: boolean;
}): Promise<AppAuthUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let email: string | null = null;
  if (options?.withEmail ?? true) {
    const clerkUser = await clerkClient().users.getUser(userId);
    email = clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress ??
      null;
  }
  const id = clerkIdToUuid(userId);

  if (options?.ensureProfile) {
    await prisma.userProfile.upsert({
      where: { id },
      create: { id },
      update: {},
    });
  }

  return { id, clerkId: userId, email };
}
