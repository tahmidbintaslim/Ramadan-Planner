// Server-only handler for POST /api/events: one first-party usage event (CSRF-checked, per-IP rate limited).
// Stores the event name, path, locale and, for signed-in users only, their app user id. No IP, no user agent.
import "@tanstack/react-start/server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppAuthUser } from "@/lib/auth/server";
import { USAGE_EVENTS, cleanPath } from "@/lib/usage-events";
import { guarded, json } from "./http";

const schema = z.object({
  name: z.enum(USAGE_EVENTS),
  path: z.string().max(400).regex(/^\/[^\s]*$/),
  locale: z.enum(["bn", "en"]).optional(),
});

export interface UsageEventDeps {
  getUserId: () => Promise<string | null>;
  insert: (row: { name: string; path: string; locale: string; userId: string | null }) => Promise<unknown>;
}

const defaultDeps: UsageEventDeps = {
  getUserId: async () => (await getAppAuthUser({ ensureProfile: false, withEmail: false }).catch(() => null))?.id ?? null,
  insert: (row) => prisma.usageEvent.create({ data: row }),
};

export function handleUsageEvent(request: Request, deps: UsageEventDeps = defaultDeps): Promise<Response> {
  return guarded("api/events", async () => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false }, { status: 400 });
    const { name, path, locale } = parsed.data;
    await deps.insert({ name, path: cleanPath(path), locale: locale ?? "", userId: await deps.getUserId() });
    return new Response(null, { status: 204 });
  });
}
