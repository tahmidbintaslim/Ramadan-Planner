// Server-only handler for GET /api/calendar/ics/$secret, ported from src/app/api/calendar/ics/[secret]/route.ts.
import "@tanstack/react-start/server-only";
import { prisma } from "@/lib/prisma";
import { buildIcsFromRules } from "@/lib/calendar";
import { guarded, json } from "./http";

export const ICS_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=21600";

type RuleType =
  | "sehri"
  | "iftar"
  | "fajr"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha"
  | "taraweeh"
  | "tahajjud"
  | "custom";

export async function handleIcs(_request: Request, secret: string): Promise<Response> {
  return guarded("api/calendar/ics", async () => {
    if (!secret || secret.trim().length < 8) {
      return json({ error: "Invalid calendar secret" }, { status: 400 });
    }

    const calendarLink = await prisma.calendarLink.findFirst({
      where: { icsSecret: secret },
      select: { userId: true, icsSecret: true },
    });

    if (!calendarLink) {
      return json({ error: "Calendar not found" }, { status: 404 });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { id: calendarLink.userId },
      select: {
        timezone: true,
        latitude: true,
        longitude: true,
        locationLabel: true,
      },
    });

    if (!profile) {
      return json({ error: "Profile not found" }, { status: 404 });
    }

    const rules = await prisma.reminderRule.findMany({
      where: {
        userId: calendarLink.userId,
        enabled: true,
      },
      select: {
        id: true,
        type: true,
        label: true,
        offsetMinutes: true,
        channels: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const calendarRules = rules
      .filter((rule) => Array.isArray(rule.channels) && rule.channels.includes("calendar"))
      .map((rule) => ({
        id: rule.id,
        type: rule.type as RuleType,
        label: rule.label,
        offsetMinutes: rule.offsetMinutes,
      }));

    const ics = await buildIcsFromRules({
      secret,
      timezone: profile.timezone,
      latitude: profile.latitude,
      longitude: profile.longitude,
      locationLabel: profile.locationLabel,
      rules: calendarRules,
      days: 45,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="ramadan-planner.ics"',
        "Cache-Control": ICS_CACHE_CONTROL,
      },
    });
  });
}
