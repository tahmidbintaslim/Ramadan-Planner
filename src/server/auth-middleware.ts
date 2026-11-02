import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getAppAuthUser } from "@/lib/auth/server";

// Every server function that needs a signed-in user uses this. The handler only runs with a user.
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getAppAuthUser({ ensureProfile: true });
  if (!user) {
    // Without this the serialized error goes out with HTTP 200 (spike finding, Gotcha A).
    setResponseStatus(401);
    throw new Error("Unauthorized");
  }
  return next({ context: { userId: user.id } });
});
