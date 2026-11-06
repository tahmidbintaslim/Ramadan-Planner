// Server-only implementations of the integrations server functions (src/actions/integrations.ts).
// Each xImpl is the old xAction body with the auth preamble replaced by the `userId` parameter, which the
// auth middleware supplies. Every query MUST be keyed by `userId`.
import "@tanstack/react-start/server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildCalendarEventsFromRules } from "@/lib/calendar";
import { decryptJson, encryptJson } from "@/lib/secure-json";
import { hashIcsSecret, newIcsSecret } from "@/lib/ics-secret";
import {
  ensureRamadanCalendar,
  parseGoogleTokens,
  refreshGoogleTokens,
  syncEventsToGoogleCalendar,
  type GoogleTokens,
} from "@/lib/google-calendar";

import {
  type GoogleCalendarStatusDTO,
  type IcsLinkDTO,
  type IntegrationResult,
} from "@/actions/integrations-schemas";
import { getCallerWithEmail } from "@/server/caller";

/**
 * The caller's ICS feed link. Only the secret's SHA-256 is stored, so the plaintext URL can be returned only
 * when the link is created here (or when a legacy plaintext row is migrated to the hash on this call). An
 * existing hashed link answers `{ secret: null, urlPath: null, active: true }`: the user revokes it and
 * generates a new one to see a URL again.
 */
export async function getOrCreateIcsLinkImpl(userId: string): Promise<IntegrationResult<IcsLinkDTO>> {
  const existing = await prisma.calendarLink.findUnique({
    where: { userId },
    select: { icsSecret: true, icsSecretHash: true },
  });

  if (existing?.icsSecretHash) {
    return { ok: true, data: { secret: null, urlPath: null, active: true } };
  }

  const legacy = existing?.icsSecret?.trim() ?? "";
  // Legacy plaintext row (before migration 008): shown once more, and rewritten to the hash now.
  const secret = legacy.length > 0 ? legacy : newIcsSecret();
  const icsSecretHash = hashIcsSecret(secret);

  await prisma.calendarLink.upsert({
    where: { userId },
    create: { userId, icsSecretHash, icsSecret: null },
    update: { icsSecretHash, icsSecret: null },
  });

  return {
    ok: true,
    data: { secret, urlPath: `/api/calendar/ics/${secret}`, active: true },
  };
}

export async function revokeIcsLinkImpl(userId: string): Promise<IntegrationResult<null>> {
  await prisma.calendarLink.upsert({
    where: { userId },
    create: { userId, icsSecret: null, icsSecretHash: null },
    update: { icsSecret: null, icsSecretHash: null },
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
      select: { googleTokens: true, icsSecret: true, icsSecretHash: true },
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

  // Seed for the event UIDs. The ICS feed seeds them with the secret's hash, so a linked user gets the
  // same UIDs in both; without an ICS link a fixed per-user seed is used. The sync no longer creates an ICS
  // link as a side effect (it used to store a fresh plaintext secret). A changed seed is harmless: the sync
  // deletes Google events whose ids are no longer wanted.
  const legacySecret = link?.icsSecret?.trim() ?? "";
  const uidSeed =
    link?.icsSecretHash ??
    (legacySecret.length > 0 ? hashIcsSecret(legacySecret) : hashIcsSecret(`google-sync:${userId}`));

  const events = await buildCalendarEventsFromRules({
    secret: uidSeed,
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
    },
    update: {
      googleTokens: encryptJson(nextTokens) as unknown as Prisma.InputJsonValue,
    },
  });

  if (refreshed.accessToken !== parsedTokens.accessToken || refreshed.expiryDate !== parsedTokens.expiryDate) {
    await persistGoogleTokens(userId, nextTokens);
  }

  return { ok: true, data: { syncedEvents } };
}
