// Admin-users server functions. Each `xAction` keeps its old name, arguments and AdminUsersResult shape, and
// calls a POST server function behind `authMiddleware` (HTTP 401 when signed out). Admin rights are checked
// inside the Impl on every call (src/server/admin-users-impl.ts, server-only).
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/server/auth-middleware";
import { callAuthed } from "@/server/call-authed";
import {
  addAdminUserImpl,
  listAdminUsersImpl,
  removeAdminUserImpl,
} from "@/server/admin-users-impl";
import type { AdminUsersResult } from "./admin-users-schemas";

export type { AdminUsersResult } from "./admin-users-schemas";

const listAdminUsersFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => listAdminUsersImpl(context.userId));

// The target id is validated INSIDE the Impl, after the admin check, as before.
const addAdminUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: unknown) => userId as string)
  .handler(({ data, context }) => addAdminUserImpl(context.userId, data));

const removeAdminUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: unknown) => userId as string)
  .handler(({ data, context }) => removeAdminUserImpl(context.userId, data));

export async function listAdminUsersAction(): Promise<
  AdminUsersResult<Array<{ userId: string; createdAt: string }>>
> {
  return callAuthed(() => listAdminUsersFn());
}

export async function addAdminUserAction(
  userId: string,
): Promise<AdminUsersResult<{ userId: string }>> {
  return callAuthed(() => addAdminUserFn({ data: userId }));
}

export async function removeAdminUserAction(
  userId: string,
): Promise<AdminUsersResult<null>> {
  return callAuthed(() => removeAdminUserFn({ data: userId }));
}
