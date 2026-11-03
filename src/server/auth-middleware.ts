import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getAppAuthUser, type AppAuthUser } from "@/lib/auth/server";
import { AUTH_UNAVAILABLE_MESSAGE, UNAUTHORIZED_MESSAGE } from "./errors";

// Every server function that needs a signed-in user uses this. The handler only runs with a user.
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  let user: AppAuthUser | null;
  try {
    // withEmail: false -> no Clerk Backend request on every server function call (only the session check).
    user = await getAppAuthUser({ ensureProfile: true, withEmail: false });
  } catch (error) {
    // Never serialize the backend's error text (Clerk/Prisma) to the client: log it, answer generically.
    console.error("[authMiddleware] auth lookup failed", error);
    setResponseStatus(503);
    throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  }
  if (!user) {
    // Without this the serialized error goes out with HTTP 200 (spike finding, Gotcha A).
    setResponseStatus(401);
    throw new Error(UNAUTHORIZED_MESSAGE);
  }
  return next({ context: { userId: user.id } });
});
