// Announcements server functions. Each `xAction` keeps its old name, arguments and AnnouncementResult shape.
//   - listActiveAnnouncementsAction is PUBLIC (the old action had no auth; GET /api/announcements serves it to
//     signed-out visitors), so its server function has NO authMiddleware.
//   - the admin actions run behind `authMiddleware` (HTTP 401 when signed out); admin rights are checked inside
//     the Impl on every call (src/server/announcements-impl.ts, server-only).
// The Impl functions are plain: route handlers call them directly, without these wrappers.
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/server/auth-middleware";
import { callAuthed } from "@/server/call-authed";
import {
  deleteAnnouncementImpl,
  listActiveAnnouncementsImpl,
  listAdminAnnouncementsImpl,
  saveAnnouncementImpl,
} from "@/server/announcements-impl";
import type {
  AnnouncementDTO,
  AnnouncementResult,
  SaveAnnouncementInput,
} from "./announcements-schemas";

export type {
  AnnouncementDTO,
  AnnouncementResult,
  SaveAnnouncementInput,
} from "./announcements-schemas";

// No authMiddleware: public read.
const listActiveAnnouncementsFn = createServerFn({ method: "POST" }).handler(() =>
  listActiveAnnouncementsImpl(),
);

const listAdminAnnouncementsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => listAdminAnnouncementsImpl(context.userId));

// The input is validated INSIDE the Impl, after the admin check, as before (non-admins get "forbidden", not
// "invalid_input"); the validator here only passes it through.
const saveAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(({ data, context }) => saveAnnouncementImpl(context.userId, data));

const deleteAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => id as string)
  .handler(({ data, context }) => deleteAnnouncementImpl(context.userId, data));

export async function listActiveAnnouncementsAction(): Promise<
  AnnouncementResult<AnnouncementDTO[]>
> {
  return listActiveAnnouncementsFn();
}

export async function listAdminAnnouncementsAction(): Promise<
  AnnouncementResult<AnnouncementDTO[]>
> {
  return callAuthed(() => listAdminAnnouncementsFn());
}

export async function saveAnnouncementAction(
  input: SaveAnnouncementInput,
): Promise<AnnouncementResult<AnnouncementDTO>> {
  return callAuthed(() => saveAnnouncementFn({ data: input }));
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<AnnouncementResult<null>> {
  return callAuthed(() => deleteAnnouncementFn({ data: id }));
}
