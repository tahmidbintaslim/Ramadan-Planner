import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppAuthUser } from "@/lib/auth/server";

const payloadSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const user = await getAppAuthUser({ ensureProfile: true });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid subscription payload" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, endpoint: parsed.data.endpoint },
  });

  await prisma.pushSubscription.create({
    data: {
      userId: user.id,
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
    },
  });

  return NextResponse.json({ ok: true });
}
