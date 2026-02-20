import { NextRequest, NextResponse } from "next/server";
import { buildGoogleOAuthUrl } from "@/lib/google-calendar";
import { getAppAuthUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const user = await getAppAuthUser({ ensureProfile: true });
  if (!user) {
    const loginUrl = new URL("/sign-in", request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  const state = crypto.randomUUID();
  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/calendar/google/callback`;
  const oauthUrl = buildGoogleOAuthUrl({ state, redirectUri });

  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set("rp_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar/google",
    maxAge: 60 * 10,
  });

  return response;
}
