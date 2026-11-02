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
}): Promise<AppAuthUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await clerkClient().users.getUser(userId);
  const email = clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    null;
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
