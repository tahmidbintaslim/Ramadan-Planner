// Server-only: the signed-in caller WITH email, for the few Impls that need it (admin checks, the Google
// calendar status). The auth middleware passes `withEmail: false`, so the email is looked up here instead.
import "@tanstack/react-start/server-only";
import { getAppAuthUser, type AppAuthUser } from "@/lib/auth/server";

/** The current session's user (with email), or null when signed out or it is not `userId`. */
export async function getCallerWithEmail(userId: string): Promise<AppAuthUser | null> {
  const user = await getAppAuthUser({ withEmail: true });
  if (!user || user.id !== userId) return null;
  return user;
}
