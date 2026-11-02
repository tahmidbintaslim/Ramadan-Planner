// Server-only handler for POST /api/push/subscribe, ported from src/app/api/push/subscribe/route.ts.
import "@tanstack/react-start/server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppAuthUser } from "@/lib/auth/server";
import { guarded, json } from "./http";

const payloadSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export interface PushSubscribeDeps {
  /** App user id of the signed-in caller (profile row ensured), or null when signed out. */
  getUserId: () => Promise<string | null>;
}

const defaultDeps: PushSubscribeDeps = {
  getUserId: async () =>
    (await getAppAuthUser({ ensureProfile: true, withEmail: false }))?.id ?? null,
};

export async function handlePushSubscribe(
  request: Request,
  deps: PushSubscribeDeps = defaultDeps,
): Promise<Response> {
  return guarded("api/push/subscribe", async () => {
    const userId = await deps.getUserId();
    if (!userId) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, error: "Invalid subscription payload" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint: parsed.data.endpoint },
    });

    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
      },
    });

    return json({ ok: true });
  });
}
