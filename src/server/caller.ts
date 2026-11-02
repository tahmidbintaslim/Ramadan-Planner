// Server-only: the signed-in caller WITH email, for the few Impls that need it (admin checks, the Google
// calendar status). The auth middleware passes `withEmail: false`, so the email is looked up here instead.
import "@tanstack/react-start/server-only";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getAppAuthUser, type AppAuthUser } from "@/lib/auth/server";
import { AUTH_UNAVAILABLE_MESSAGE } from "./errors";

/** The current session's user (with email), or null when signed out or it is not `userId`. */
export async function getCallerWithEmail(userId: string): Promise<AppAuthUser | null> {
  let user: AppAuthUser | null;
  try {
    user = await getAppAuthUser({ withEmail: true });
  } catch (error) {
    // Never serialize the backend's error text (Clerk) to the client: log it, answer generically.
    console.error("[getCallerWithEmail] auth lookup failed", error);
    setResponseStatus(503);
    throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  }
  if (!user || user.id !== userId) return null;
  return user;
}
