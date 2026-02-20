import { createHash } from "node:crypto";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export interface AppAuthUser {
  id: string;
  clerkId: string;
  email: string | null;
}

function clerkIdToUuid(clerkId: string): string {
  const hash = createHash("sha256").update(`ramadan-planner:${clerkId}`).digest("hex");
  const bytes = hash.slice(0, 32).split("");

  bytes[12] = "5";
  const variant = Number.parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);

  const base = bytes.join("");
  return `${base.slice(0, 8)}-${base.slice(8, 12)}-${base.slice(12, 16)}-${base.slice(16, 20)}-${base.slice(20, 32)}`;
}

export async function getAppAuthUser(options?: {
  ensureProfile?: boolean;
}): Promise<AppAuthUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
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
