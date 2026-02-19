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
}): Promise<boolean> {
  if (isAdminEmail(params.email)) {
    return true;
  }

  const row = await prisma.adminUser.findUnique({
    where: { userId: params.userId },
    select: { userId: true },
  });

  return Boolean(row);
}
