// Integrations server functions. Each `xAction` keeps its old name and IntegrationResult shape, and calls a
// POST server function behind `authMiddleware` (HTTP 401 when signed out). The bodies live in
// src/server/integrations-impl.ts (server-only); the Start compiler strips the handlers, and with them that
// import, from the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/server/auth-middleware";
import { callAuthed } from "@/server/call-authed";
import {
  disconnectGoogleCalendarImpl,
  getGoogleCalendarStatusImpl,
  getOrCreateIcsLinkImpl,
  getPushStatusImpl,
  revokeIcsLinkImpl,
  syncGoogleCalendarImpl,
} from "@/server/integrations-impl";
import type {
  GoogleCalendarStatusDTO,
  IntegrationResult,
} from "./integrations-schemas";

export type {
  GoogleCalendarStatusDTO,
  IntegrationResult,
} from "./integrations-schemas";

const getOrCreateIcsLinkFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => getOrCreateIcsLinkImpl(context.userId));

const revokeIcsLinkFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => revokeIcsLinkImpl(context.userId));

const getPushStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => getPushStatusImpl(context.userId));

const getGoogleCalendarStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => getGoogleCalendarStatusImpl(context.userId));

const disconnectGoogleCalendarFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => disconnectGoogleCalendarImpl(context.userId));

const syncGoogleCalendarFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => syncGoogleCalendarImpl(context.userId));

export async function getOrCreateIcsLinkAction(): Promise<
  IntegrationResult<{ secret: string; urlPath: string }>
> {
  return callAuthed(() => getOrCreateIcsLinkFn());
}

export async function revokeIcsLinkAction(): Promise<IntegrationResult<null>> {
  return callAuthed(() => revokeIcsLinkFn());
}

export async function getPushStatusAction(): Promise<
  IntegrationResult<{ subscriptions: number }>
> {
  return callAuthed(() => getPushStatusFn());
}

export async function getGoogleCalendarStatusAction(): Promise<
  IntegrationResult<GoogleCalendarStatusDTO>
> {
  return callAuthed(() => getGoogleCalendarStatusFn());
}

export async function disconnectGoogleCalendarAction(): Promise<
  IntegrationResult<null>
> {
  return callAuthed(() => disconnectGoogleCalendarFn());
}

export async function syncGoogleCalendarAction(): Promise<
  IntegrationResult<{ syncedEvents: number }>
> {
  return callAuthed(() => syncGoogleCalendarFn());
}
