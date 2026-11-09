// Admin overview (/admin). POST server function behind authMiddleware (401 when signed out); admin rights are
// checked inside the Impl on every call (src/server/admin-overview-impl.ts, server-only).
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/server/auth-middleware";
import { callAuthed } from "@/server/call-authed";
import { getAdminOverviewImpl } from "@/server/admin-overview-impl";
import type { AdminOverviewResult } from "@/server/admin-overview-impl";

export type { AdminOverview, AdminOverviewResult, DayCount } from "@/server/admin-overview-impl";

const getAdminOverviewFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => getAdminOverviewImpl(context.userId));

export async function getAdminOverviewAction(): Promise<AdminOverviewResult | { ok: false; error: string }> {
  return callAuthed(() => getAdminOverviewFn());
}
