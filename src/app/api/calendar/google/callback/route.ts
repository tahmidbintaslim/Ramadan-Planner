import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeGoogleCode } from "@/lib/google-calendar";
import { Prisma } from "@prisma/client";
import { encryptJson } from "@/lib/secure-json";
import { getAppAuthUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const settingsUrl = new URL("/settings", baseUrl);

  const errorParam = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (errorParam) {
    settingsUrl.searchParams.set("google", "error");
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("google", "invalid_callback");
    return NextResponse.redirect(settingsUrl);
  }

  const expectedState = request.cookies.get("rp_google_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    settingsUrl.searchParams.set("google", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  const user = await getAppAuthUser({ ensureProfile: true });
  if (!user) {
    settingsUrl.searchParams.set("google", "unauthorized");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${baseUrl}/api/calendar/google/callback`;
    const tokens = await exchangeGoogleCode({ code, redirectUri });

    await prisma.calendarLink.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        googleTokens: encryptJson(tokens) as unknown as Prisma.InputJsonValue,
      },
      update: { googleTokens: encryptJson(tokens) as unknown as Prisma.InputJsonValue },
    });

    settingsUrl.searchParams.set("google", "connected");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set("rp_google_oauth_state", "", {
      path: "/api/calendar/google",
      maxAge: 0,
    });
    return response;
  } catch {
    settingsUrl.searchParams.set("google", "exchange_failed");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set("rp_google_oauth_state", "", {
      path: "/api/calendar/google",
      maxAge: 0,
    });
    return response;
  }
}
