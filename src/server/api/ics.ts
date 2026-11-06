// Server-only handler for GET /api/calendar/ics/$secret, ported from src/app/api/calendar/ics/[secret]/route.ts.
import "@tanstack/react-start/server-only";
import { prisma } from "@/lib/prisma";
import { buildIcsFromRules } from "@/lib/calendar";
import { hashIcsSecret } from "@/lib/ics-secret";
import { guarded, json } from "./http";

// The URL carries a bearer secret and the body is personal (location, reminders): never stored by a shared
// cache (CDN) or the browser cache. Calendar clients poll it themselves.
export const ICS_CACHE_CONTROL = "private, no-store";
const NO_STORE = { "Cache-Control": "no-store" };
/** Issued secrets are 32 hex chars; anything far longer is not a secret we issued. */
const MAX_SECRET_LENGTH = 128;

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
    if (!secret || secret.trim().length < 8 || secret.length > MAX_SECRET_LENGTH) {
      return json({ error: "Invalid calendar secret" }, { status: 400, headers: NO_STORE });
    }

    // Only the SHA-256 is stored. Rows written before migration 008 may still hold the plaintext: match
    // either, then rewrite a legacy row to the hash so the plaintext disappears on first use.
    const secretHash = hashIcsSecret(secret);
    const calendarLink = await prisma.calendarLink.findFirst({
      where: { OR: [{ icsSecretHash: secretHash }, { icsSecret: secret }] },
      select: { id: true, userId: true, icsSecretHash: true },
    });

    if (!calendarLink) {
      return json({ error: "Calendar not found" }, { status: 404, headers: NO_STORE });
    }

    if (calendarLink.icsSecretHash !== secretHash) {
      try {
        await prisma.calendarLink.updateMany({
          where: { id: calendarLink.id, icsSecret: secret },
          data: { icsSecretHash: secretHash, icsSecret: null },
        });
      } catch (error) {
        // The feed still works from the legacy column; retried on the next request.
        console.error("[api/calendar/ics] legacy secret rewrite failed", error);
      }
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
      return json({ error: "Profile not found" }, { status: 404, headers: NO_STORE });
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
      // Event UIDs are derived from this; the hash keeps them stable without echoing the bearer secret, and
      // matches the seed the Google sync uses (it only knows the hash).
      secret: secretHash,
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
