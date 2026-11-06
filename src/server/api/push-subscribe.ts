// Server-only handler for POST /api/push/subscribe, ported from src/app/api/push/subscribe/route.ts.
import "@tanstack/react-start/server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppAuthUser } from "@/lib/auth/server";
import {
  isAllowedPushEndpoint,
  MAX_AUTH_LENGTH,
  MAX_ENDPOINT_LENGTH,
  MAX_P256DH_LENGTH,
  MAX_SUBSCRIPTIONS_PER_USER,
} from "@/lib/push-endpoint";
import { guarded, json } from "./http";

// The dispatcher POSTs to the stored endpoint, so it is an outbound request target: https on a known push
// service only (SSRF), with bounded sizes. The dispatcher re-checks all of this before sending.
const payloadSchema = z.object({
  endpoint: z
    .string()
    .max(MAX_ENDPOINT_LENGTH)
    .refine((value) => isAllowedPushEndpoint(value)),
  keys: z.object({
    p256dh: z.string().min(1).max(MAX_P256DH_LENGTH),
    auth: z.string().min(1).max(MAX_AUTH_LENGTH),
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

    // At most MAX_SUBSCRIPTIONS_PER_USER per user: prune the oldest beyond the cap.
    const stale = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: MAX_SUBSCRIPTIONS_PER_USER,
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { userId, id: { in: stale.map((row) => row.id) } },
      });
    }

    return json({ ok: true });
  });
}
