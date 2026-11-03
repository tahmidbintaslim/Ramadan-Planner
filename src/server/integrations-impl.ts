// Server-only implementations of the integrations server functions (src/actions/integrations.ts).
// Each xImpl is the old xAction body with the auth preamble replaced by the `userId` parameter, which the
// auth middleware supplies. Every query MUST be keyed by `userId`.
import "@tanstack/react-start/server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildCalendarEventsFromRules } from "@/lib/calendar";
import { decryptJson, encryptJson } from "@/lib/secure-json";
import {
  ensureRamadanCalendar,
  parseGoogleTokens,
  refreshGoogleTokens,
  syncEventsToGoogleCalendar,
  type GoogleTokens,
} from "@/lib/google-calendar";

import {
  type GoogleCalendarStatusDTO,
  type IntegrationResult,
} from "@/actions/integrations-schemas";
import { getCallerWithEmail } from "@/server/caller";

export async function getOrCreateIcsLinkImpl(userId: string): Promise<
  IntegrationResult<{ secret: string; urlPath: string }>
> {
  const existing = await prisma.calendarLink.findUnique({
    where: { userId },
    select: { icsSecret: true },
  });

  const current = existing?.icsSecret?.trim() ?? "";
  if (current.length > 0) {
    return {
      ok: true,
      data: { secret: current, urlPath: `/api/calendar/ics/${current}` },
    };
  }

  const secret = crypto.randomUUID().replace(/-/g, "");

  await prisma.calendarLink.upsert({
    where: { userId },
    create: { userId, icsSecret: secret },
    update: { icsSecret: secret },
  });

  return {
    ok: true,
    data: { secret, urlPath: `/api/calendar/ics/${secret}` },
  };
}

export async function revokeIcsLinkImpl(userId: string): Promise<IntegrationResult<null>> {
  await prisma.calendarLink.upsert({
    where: { userId },
    create: { userId, icsSecret: null },
    update: { icsSecret: null },
  });

  return { ok: true, data: null };
}

export async function getPushStatusImpl(userId: string): Promise<
  IntegrationResult<{ subscriptions: number }>
> {
  const count = await prisma.pushSubscription.count({
    where: { userId },
  });

  return { ok: true, data: { subscriptions: count } };
}

export async function getGoogleCalendarStatusImpl(userId: string): Promise<
  IntegrationResult<GoogleCalendarStatusDTO>
> {
  const link = await prisma.calendarLink.findUnique({
    where: { userId },
    select: { googleTokens: true },
  });

  // The auth middleware does not look the email up (withEmail: false); fetch it here, as the old action had it.
  const caller = await getCallerWithEmail(userId);
  if (!caller) return { ok: false, error: "unauthorized" };

  const tokens = parseGoogleTokens(decryptJson(link?.googleTokens ?? null));
  return {
    ok: true,
    data: {
      connected: Boolean(tokens),
      email: caller.email,
      syncedAt: tokens?.syncedAt ?? null,
    },
  };
}

async function persistGoogleTokens(userId: string, tokens: GoogleTokens): Promise<void> {
  const encrypted = encryptJson(tokens);
  await prisma.calendarLink.upsert({
    where: { userId },
    create: { userId, googleTokens: encrypted as unknown as Prisma.InputJsonValue },
    update: { googleTokens: encrypted as unknown as Prisma.InputJsonValue },
  });
}

export async function disconnectGoogleCalendarImpl(userId: string): Promise<
  IntegrationResult<null>
> {
  await prisma.calendarLink.upsert({
    where: { userId },
    create: { userId, googleTokens: Prisma.JsonNullValueInput.JsonNull },
    update: { googleTokens: Prisma.JsonNullValueInput.JsonNull },
  });

  return { ok: true, data: null };
}

export async function syncGoogleCalendarImpl(userId: string): Promise<
  IntegrationResult<{ syncedEvents: number }>
> {
  const [profile, link, rules] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        latitude: true,
        longitude: true,
        locationLabel: true,
      },
    }),
    prisma.calendarLink.findUnique({
      where: { userId },
      select: { googleTokens: true, icsSecret: true },
    }),
    prisma.reminderRule.findMany({
      where: { userId, enabled: true },
      select: {
        id: true,
        type: true,
        label: true,
        offsetMinutes: true,
        channels: true,
      },
    }),
  ]);

  if (!profile) {
    return { ok: false, error: "profile_missing" };
  }

  const parsedTokens = parseGoogleTokens(decryptJson(link?.googleTokens ?? null));
  if (!parsedTokens) {
    return { ok: false, error: "google_not_connected" };
  }

  const refreshed = await refreshGoogleTokens(parsedTokens);

  const calendarRules = rules
    .filter((rule) => Array.isArray(rule.channels) && rule.channels.includes("calendar"))
    .map((rule) => ({
      id: rule.id,
      type: rule.type as
        | "sehri"
        | "iftar"
        | "fajr"
        | "dhuhr"
        | "asr"
        | "maghrib"
        | "isha"
        | "taraweeh"
        | "tahajjud"
        | "custom",
      label: rule.label,
      offsetMinutes: rule.offsetMinutes,
    }));

  const secret =
    link?.icsSecret && link.icsSecret.trim().length > 0
      ? link.icsSecret
      : crypto.randomUUID().replace(/-/g, "");

  const events = await buildCalendarEventsFromRules({
    secret,
    timezone: profile.timezone,
    latitude: profile.latitude,
    longitude: profile.longitude,
    locationLabel: profile.locationLabel,
    rules: calendarRules,
    days: 45,
  });

  const calendarId = await ensureRamadanCalendar({
    accessToken: refreshed.accessToken,
    timezone: profile.timezone,
    existingCalendarId: refreshed.calendarId,
  });

  const syncedEvents = await syncEventsToGoogleCalendar({
    accessToken: refreshed.accessToken,
    calendarId,
    timezone: profile.timezone,
    events,
  });

  const nextTokens: GoogleTokens = {
    ...refreshed,
    calendarId,
    syncedAt: new Date().toISOString(),
  };

  await prisma.calendarLink.upsert({
    where: { userId },
    create: {
      userId,
      googleTokens: encryptJson(nextTokens) as unknown as Prisma.InputJsonValue,
      icsSecret: secret,
    },
    update: {
      googleTokens: encryptJson(nextTokens) as unknown as Prisma.InputJsonValue,
      icsSecret: secret,
    },
  });

  if (refreshed.accessToken !== parsedTokens.accessToken || refreshed.expiryDate !== parsedTokens.expiryDate) {
    await persistGoogleTokens(userId, nextTokens);
  }

  return { ok: true, data: { syncedEvents } };
}
