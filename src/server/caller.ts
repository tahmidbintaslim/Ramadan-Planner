// Server-only: the signed-in caller WITH email, for the few Impls that need it (admin checks, the Google
// calendar status). The auth middleware passes `withEmail: false`, so the email is looked up here instead.
import "@tanstack/react-start/server-only";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getAppAuthUser, type AppAuthUser } from "@/lib/auth/server";
import { AUTH_UNAVAILABLE_MESSAGE } from "./errors";

/** The current session's user (with email), or null when signed out. Auth-backend failure: HTTP 503 `auth_unavailable`. */
export async function getCurrentUserWithEmail(): Promise<AppAuthUser | null> {
  try {
    return await getAppAuthUser({ withEmail: true });
  } catch (error) {
    // Never serialize the backend's error text (Clerk) to the client: log it, answer generically.
    console.error("[getCallerWithEmail] auth lookup failed", error);
    setResponseStatus(503);
    throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  }
}

/** The current session's user (with email), or null when signed out or it is not `userId`. */
export async function getCallerWithEmail(userId: string): Promise<AppAuthUser | null> {
  const user = await getCurrentUserWithEmail();
  if (!user || user.id !== userId) return null;
  return user;
}
