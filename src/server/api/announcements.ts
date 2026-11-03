// Server-only handlers for /api/announcements (GET public, POST admin) and /api/announcements/$id (PATCH, DELETE
// admin). Ported from src/app/api/announcements/**/route.ts. The Impls check admin rights themselves on every
// call; the handler only resolves the signed-in user from the Clerk session and passes the app user id.
import "@tanstack/react-start/server-only";
import { getAppAuthUser } from "@/lib/auth/server";
import {
  deleteAnnouncementImpl,
  listActiveAnnouncementsImpl,
  saveAnnouncementImpl,
} from "@/server/announcements-impl";
import { guarded, json } from "./http";

export interface AnnouncementsDeps {
  /** App user id (UUID) of the signed-in caller, or null when signed out. */
  getUserId: () => Promise<string | null>;
}

const defaultDeps: AnnouncementsDeps = {
  getUserId: async () => (await getAppAuthUser({ withEmail: false }))?.id ?? null,
};

type Failure = { ok: false; error: string };

function failure(res: Failure): Response {
  const status = res.error === "unauthorized" ? 401 : res.error === "forbidden" ? 403 : 400;
  return json({ ok: false, error: res.error }, { status });
}

const UNAUTHORIZED: Failure = { ok: false, error: "unauthorized" };

/** GET /api/announcements: public list of active announcements. */
export async function handleAnnouncementsGet(): Promise<Response> {
  try {
    const res = await listActiveAnnouncementsImpl();
    if (res.ok) {
      return json({ ok: true, data: res.data });
    }
  } catch (error) {
    console.error("[api/announcements] database read failed", error);
  }

  return json(
    {
      ok: false,
      error: {
        code: "unavailable",
        message: "Announcements are temporarily unavailable",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/announcements: create (or update when the body has an id). Admin only. */
export async function handleAnnouncementsPost(
  request: Request,
  deps: AnnouncementsDeps = defaultDeps,
): Promise<Response> {
  return guarded("api/announcements", async () => {
    const userId = await deps.getUserId();
    if (!userId) return failure(UNAUTHORIZED);

    const body = await request.json().catch(() => null);
    const res = await saveAnnouncementImpl(userId, body);
    if (!res.ok) return failure(res);
    return json({ ok: true, data: res.data });
  });
}

/** PATCH /api/announcements/$id. Admin only. */
export async function handleAnnouncementPatch(
  request: Request,
  id: string,
  deps: AnnouncementsDeps = defaultDeps,
): Promise<Response> {
  return guarded("api/announcements/[id]", async () => {
    const userId = await deps.getUserId();
    if (!userId) return failure(UNAUTHORIZED);

    const body = await request.json().catch(() => null);
    const res = await saveAnnouncementImpl(userId, { ...(body ?? {}), id });
    if (!res.ok) return failure(res);
    return json({ ok: true, data: res.data });
  });
}

/** DELETE /api/announcements/$id. Admin only. */
export async function handleAnnouncementDelete(
  _request: Request,
  id: string,
  deps: AnnouncementsDeps = defaultDeps,
): Promise<Response> {
  return guarded("api/announcements/[id]", async () => {
    const userId = await deps.getUserId();
    if (!userId) return failure(UNAUTHORIZED);

    const res = await deleteAnnouncementImpl(userId, id);
    if (!res.ok) return failure(res);
    return json({ ok: true });
  });
}
