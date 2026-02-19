import crypto from "node:crypto";
import type { GeneratedCalendarEvent } from "@/lib/calendar";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
  tokenType?: string;
  scope?: string;
  calendarId?: string;
  syncedAt?: string;
  [key: string]: unknown;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_ENDPOINT = "https://www.googleapis.com/calendar/v3";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function getGoogleOAuthClientId(): string {
  return requiredEnv("GOOGLE_OAUTH_CLIENT_ID");
}

function getGoogleOAuthClientSecret(): string {
  return requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");
}

export function buildGoogleOAuthUrl(params: {
  state: string;
  redirectUri: string;
}): string {
  const clientId = getGoogleOAuthClientId();

  const search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: params.state,
  });

  return `${GOOGLE_OAUTH_BASE}?${search.toString()}`;
}

async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();

  const payload = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function exchangeGoogleCode(params: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const token = await exchangeCodeForTokens(params);
  const now = Date.now();

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiryDate: now + token.expires_in * 1000 - 60_000,
    tokenType: token.token_type,
    scope: token.scope,
  };
}

export function parseGoogleTokens(value: unknown): GoogleTokens | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  if (typeof obj.accessToken !== "string") return null;
  if (typeof obj.expiryDate !== "number") return null;

  return {
    accessToken: obj.accessToken,
    refreshToken: typeof obj.refreshToken === "string" ? obj.refreshToken : undefined,
    expiryDate: obj.expiryDate,
    tokenType: typeof obj.tokenType === "string" ? obj.tokenType : undefined,
    scope: typeof obj.scope === "string" ? obj.scope : undefined,
    calendarId: typeof obj.calendarId === "string" ? obj.calendarId : undefined,
    syncedAt: typeof obj.syncedAt === "string" ? obj.syncedAt : undefined,
  };
}

export async function refreshGoogleTokens(
  tokens: GoogleTokens,
): Promise<GoogleTokens> {
  if (tokens.expiryDate > Date.now() + 10_000) {
    return tokens;
  }

  if (!tokens.refreshToken) {
    throw new Error("Google refresh token is missing");
  }

  const payload = new URLSearchParams({
    client_id: getGoogleOAuthClientId(),
    client_secret: getGoogleOAuthClientSecret(),
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status})`);
  }

  const refreshed = (await res.json()) as GoogleTokenResponse;

  return {
    ...tokens,
    accessToken: refreshed.access_token,
    expiryDate: Date.now() + refreshed.expires_in * 1000 - 60_000,
    tokenType: refreshed.token_type ?? tokens.tokenType,
    scope: refreshed.scope ?? tokens.scope,
  };
}

async function calendarFetch<T>(params: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT";
  body?: Record<string, unknown>;
}): Promise<T> {
  const url = `${GOOGLE_CALENDAR_ENDPOINT}${params.path}`;
  const res = await fetch(url, {
    method: params.method ?? "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Google Calendar API failed (${res.status})`);
  }

  return (await res.json()) as T;
}

interface GoogleCalendarListResponse {
  items?: Array<{ id: string; summary?: string }>;
}

interface GoogleCalendarResponse {
  id: string;
}

export async function ensureRamadanCalendar(params: {
  accessToken: string;
  timezone: string;
  existingCalendarId?: string;
}): Promise<string> {
  const { accessToken, timezone, existingCalendarId } = params;

  if (existingCalendarId) {
    try {
      await calendarFetch<unknown>({
        accessToken,
        path: `/calendars/${encodeURIComponent(existingCalendarId)}`,
      });
      return existingCalendarId;
    } catch {
      // Fall through to discover/create
    }
  }

  const list = await calendarFetch<GoogleCalendarListResponse>({
    accessToken,
    path: "/users/me/calendarList",
  });

  const matched = list.items?.find((item) => item.summary === "Ramadan Planner");
  if (matched?.id) {
    return matched.id;
  }

  const created = await calendarFetch<GoogleCalendarResponse>({
    accessToken,
    path: "/calendars",
    method: "POST",
    body: {
      summary: "Ramadan Planner",
      description: "Synced reminders from Ramadan Planner",
      timeZone: timezone,
    },
  });

  return created.id;
}

function googleEventIdFromUid(uid: string): string {
  const hash = crypto.createHash("sha1").update(uid).digest("hex");
  return `rp${hash.slice(0, 40)}`;
}

async function upsertEvent(params: {
  accessToken: string;
  calendarId: string;
  event: GeneratedCalendarEvent;
  timezone: string;
}): Promise<void> {
  const { accessToken, calendarId, event, timezone } = params;
  const eventId = googleEventIdFromUid(event.uid);

  await fetch(
    `${GOOGLE_CALENDAR_ENDPOINT}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: eventId,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: timezone,
        },
        reminders: { useDefault: true },
      }),
    },
  ).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Google Calendar event upsert failed (${res.status})`);
    }
  });
}

interface GoogleEventsListResponse {
  items?: Array<{ id?: string }>;
  nextPageToken?: string;
}

async function listManagedEventIds(params: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<string[]> {
  const managed: string[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      singleEvents: "true",
      maxResults: "2500",
    });
    if (pageToken) query.set("pageToken", pageToken);

    const res = await fetch(
      `${GOOGLE_CALENDAR_ENDPOINT}/calendars/${encodeURIComponent(params.calendarId)}/events?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Google Calendar list events failed (${res.status})`);
    }

    const payload = (await res.json()) as GoogleEventsListResponse;
    const ids =
      payload.items
        ?.map((item) => item.id)
        .filter((id): id is string => typeof id === "string")
        .filter((id) => id.startsWith("rp")) ?? [];

    managed.push(...ids);
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return managed;
}

async function deleteEvent(params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_ENDPOINT}/calendars/${encodeURIComponent(params.calendarId)}/events/${params.eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    },
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Google Calendar delete event failed (${res.status})`);
  }
}

export async function syncEventsToGoogleCalendar(params: {
  accessToken: string;
  calendarId: string;
  timezone: string;
  events: GeneratedCalendarEvent[];
  cleanup?: boolean;
}): Promise<number> {
  const { accessToken, calendarId, events, timezone, cleanup = true } = params;

  if (cleanup) {
    const desiredIds = new Set(events.map((event) => googleEventIdFromUid(event.uid)));
    const now = new Date();
    const max = new Date(now.getTime() + 70 * 24 * 60 * 60 * 1000);
    const existingIds = await listManagedEventIds({
      accessToken,
      calendarId,
      timeMin: now.toISOString(),
      timeMax: max.toISOString(),
    });

    const staleIds = existingIds.filter((id) => !desiredIds.has(id));
    for (const id of staleIds) {
      await deleteEvent({ accessToken, calendarId, eventId: id });
    }
  }

  for (const event of events) {
    await upsertEvent({ accessToken, calendarId, event, timezone });
  }

  return events.length;
}
