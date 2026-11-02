// Page gate for /admin/announcements. Deliberately NOT behind authMiddleware: a signed-out visitor gets
// "unauthorized" (the page shows the sign-in links), not a 401. Every admin server function still checks
// admin rights itself (src/server/admin-users-impl.ts).
import { createServerFn } from "@tanstack/react-start";
import { getAdminAccessImpl } from "@/server/admin-users-impl";
import type { AdminAccess } from "@/server/admin-users-impl";

export type { AdminAccess } from "@/server/admin-users-impl";

const getAdminAccessFn = createServerFn({ method: "POST" }).handler(() => getAdminAccessImpl());

export async function getAdminAccessAction(): Promise<AdminAccess> {
  return getAdminAccessFn();
}
