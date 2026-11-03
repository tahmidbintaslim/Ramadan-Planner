// Server-only handlers for the Google Calendar OAuth flow, ported from
// src/app/api/calendar/google/{connect,callback}/route.ts. Same cookie, redirect targets and `?google=` values.
import "@tanstack/react-start/server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildGoogleOAuthUrl, exchangeGoogleCode } from "@/lib/google-calendar";
import { encryptJson } from "@/lib/secure-json";
import { getAppAuthUser } from "@/lib/auth/server";
import { appBaseUrl, guarded, readCookie, redirect, serializeCookie } from "./http";

export const GOOGLE_STATE_COOKIE = "rp_google_oauth_state";
const STATE_COOKIE_PATH = "/api/calendar/google";

export interface GoogleOAuthDeps {
  /** App user id of the signed-in caller (profile row ensured), or null when signed out. */
  getUserId: () => Promise<string | null>;
}

const defaultDeps: GoogleOAuthDeps = {
  getUserId: async () =>
    (await getAppAuthUser({ ensureProfile: true, withEmail: false }))?.id ?? null,
};

function clearStateCookie(): string {
  return serializeCookie(GOOGLE_STATE_COOKIE, "", { path: STATE_COOKIE_PATH, maxAge: 0 });
}

/** GET /api/calendar/google/connect: set the state cookie and send the user to Google's consent screen. */
export async function handleGoogleConnect(
  request: Request,
  deps: GoogleOAuthDeps = defaultDeps,
): Promise<Response> {
  return guarded("api/calendar/google/connect", async () => {
    const userId = await deps.getUserId();
    if (!userId) {
      return redirect(new URL("/sign-in", new URL(request.url).origin));
    }

    const state = crypto.randomUUID();
    const baseUrl = appBaseUrl(request);
    const redirectUri = `${baseUrl}/api/calendar/google/callback`;
    const oauthUrl = buildGoogleOAuthUrl({ state, redirectUri });

    return redirect(oauthUrl, [
      serializeCookie(GOOGLE_STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: STATE_COOKIE_PATH,
        maxAge: 60 * 10,
      }),
    ]);
  });
}

/** GET /api/calendar/google/callback: check state, exchange the code, store the tokens encrypted. */
export async function handleGoogleCallback(
  request: Request,
  deps: GoogleOAuthDeps = defaultDeps,
): Promise<Response> {
  return guarded("api/calendar/google/callback", async () => {
    const baseUrl = appBaseUrl(request);
    const settingsUrl = new URL("/settings", baseUrl);
    const params = new URL(request.url).searchParams;

    const errorParam = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (errorParam) {
      settingsUrl.searchParams.set("google", "error");
      return redirect(settingsUrl);
    }

    if (!code || !state) {
      settingsUrl.searchParams.set("google", "invalid_callback");
      return redirect(settingsUrl);
    }

    const expectedState = readCookie(request, GOOGLE_STATE_COOKIE);
    if (!expectedState || expectedState !== state) {
      settingsUrl.searchParams.set("google", "invalid_state");
      return redirect(settingsUrl);
    }

    const userId = await deps.getUserId();
    if (!userId) {
      settingsUrl.searchParams.set("google", "unauthorized");
      return redirect(settingsUrl);
    }

    try {
      const redirectUri = `${baseUrl}/api/calendar/google/callback`;
      const tokens = await exchangeGoogleCode({ code, redirectUri });

      await prisma.calendarLink.upsert({
        where: { userId },
        create: {
          userId,
          googleTokens: encryptJson(tokens) as unknown as Prisma.InputJsonValue,
        },
        update: { googleTokens: encryptJson(tokens) as unknown as Prisma.InputJsonValue },
      });

      settingsUrl.searchParams.set("google", "connected");
      return redirect(settingsUrl, [clearStateCookie()]);
    } catch (error) {
      // The old handler swallowed this silently; log it server-side (never the tokens) for diagnosis.
      console.error("[api/calendar/google/callback] token exchange or storage failed", error instanceof Error ? error.message : "unknown");
      settingsUrl.searchParams.set("google", "exchange_failed");
      return redirect(settingsUrl, [clearStateCookie()]);
    }
  });
}
