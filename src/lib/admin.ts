// Server-only: reads ADMIN_EMAILS and the AdminUser table.
import "@tanstack/react-start/server-only";
import { prisma } from "@/lib/prisma";

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().includes(email.toLowerCase());
}

export async function isUserAdmin(params: {
  userId: string;
  email?: string | null;
  /** Clerk's verification status of `email` is "verified". ADMIN_EMAILS never matches an unverified address. */
  emailVerified?: boolean;
}): Promise<boolean> {
  if (params.emailVerified === true && isAdminEmail(params.email)) {
    return true;
  }

  const row = await prisma.adminUser.findUnique({
    where: { userId: params.userId },
    select: { userId: true },
  });

  return Boolean(row);
}
