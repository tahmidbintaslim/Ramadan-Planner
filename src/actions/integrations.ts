"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAppAuthUser } from "@/lib/auth/server";
import { buildCalendarEventsFromRules } from "@/lib/calendar";
import { decryptJson, encryptJson } from "@/lib/secure-json";
import {
  ensureRamadanCalendar,
  parseGoogleTokens,
  refreshGoogleTokens,
  syncEventsToGoogleCalendar,
  type GoogleTokens,
} from "@/lib/google-calendar";

export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getUser(): Promise<
  IntegrationResult<{ id: string; email: string | null }>
> {
  const user = await getAppAuthUser({ ensureProfile: true });
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }

  return { ok: true, data: { id: user.id, email: user.email } };
}

export async function getOrCreateIcsLinkAction(): Promise<
  IntegrationResult<{ secret: string; urlPath: string }>
> {
  const auth = await getUser();
  if (!auth.ok) return auth;

  const existing = await prisma.calendarLink.findUnique({
    where: { userId: auth.data.id },
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
    where: { userId: auth.data.id },
    create: { userId: auth.data.id, icsSecret: secret },
    update: { icsSecret: secret },
  });

  return {
    ok: true,
    data: { secret, urlPath: `/api/calendar/ics/${secret}` },
  };
}

export async function revokeIcsLinkAction(): Promise<IntegrationResult<null>> {
  const auth = await getUser();
  if (!auth.ok) return auth;

  await prisma.calendarLink.upsert({
    where: { userId: auth.data.id },
    create: { userId: auth.data.id, icsSecret: null },
    update: { icsSecret: null },
  });

  return { ok: true, data: null };
}

export async function getPushStatusAction(): Promise<
  IntegrationResult<{ subscriptions: number }>
> {
  const auth = await getUser();
  if (!auth.ok) return auth;

  const count = await prisma.pushSubscription.count({
    where: { userId: auth.data.id },
  });

  return { ok: true, data: { subscriptions: count } };
}

export async function getGoogleCalendarStatusAction(): Promise<
  IntegrationResult<{ connected: boolean; email: string | null; syncedAt: string | null }>
> {
  const auth = await getUser();
  if (!auth.ok) return auth;

  const link = await prisma.calendarLink.findUnique({
    where: { userId: auth.data.id },
    select: { googleTokens: true },
  });

  const tokens = parseGoogleTokens(decryptJson(link?.googleTokens ?? null));
  return {
    ok: true,
    data: {
      connected: Boolean(tokens),
      email: auth.data.email,
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

export async function disconnectGoogleCalendarAction(): Promise<
  IntegrationResult<null>
> {
  const auth = await getUser();
  if (!auth.ok) return auth;

  await prisma.calendarLink.upsert({
    where: { userId: auth.data.id },
    create: { userId: auth.data.id, googleTokens: Prisma.JsonNullValueInput.JsonNull },
    update: { googleTokens: Prisma.JsonNullValueInput.JsonNull },
  });

  return { ok: true, data: null };
}

export async function syncGoogleCalendarAction(): Promise<
  IntegrationResult<{ syncedEvents: number }>
> {
  const auth = await getUser();
  if (!auth.ok) return auth;

  const [profile, link, rules] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: auth.data.id },
      select: {
        timezone: true,
        latitude: true,
        longitude: true,
        locationLabel: true,
      },
    }),
    prisma.calendarLink.findUnique({
      where: { userId: auth.data.id },
      select: { googleTokens: true, icsSecret: true },
    }),
    prisma.reminderRule.findMany({
      where: { userId: auth.data.id, enabled: true },
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
    where: { userId: auth.data.id },
    create: {
      userId: auth.data.id,
      googleTokens: encryptJson(nextTokens) as unknown as Prisma.InputJsonValue,
      icsSecret: secret,
    },
    update: {
      googleTokens: encryptJson(nextTokens) as unknown as Prisma.InputJsonValue,
      icsSecret: secret,
    },
  });

  if (refreshed.accessToken !== parsedTokens.accessToken || refreshed.expiryDate !== parsedTokens.expiryDate) {
    await persistGoogleTokens(auth.data.id, nextTokens);
  }

  return { ok: true, data: { syncedEvents } };
}
