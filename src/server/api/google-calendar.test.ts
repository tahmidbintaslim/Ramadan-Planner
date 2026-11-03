import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "db99edd8-fa85-5bc2-95ec-a499147bb210";
const STATE = "0b8c3c1e-0000-4000-8000-000000000001";

const m = vi.hoisted(() => ({
  prisma: { calendarLink: { upsert: vi.fn() } },
  exchangeGoogleCode: vi.fn(),
  getAppAuthUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auth/server", () => ({ getAppAuthUser: m.getAppAuthUser }));
vi.mock("@/lib/google-calendar", async (orig) => ({
  ...(await orig<typeof import("@/lib/google-calendar")>()),
  exchangeGoogleCode: m.exchangeGoogleCode,
}));

import { handleGoogleCallback, handleGoogleConnect } from "./google-calendar";
import { decryptJson } from "@/lib/secure-json";

const ORIGIN = "https://app.example";
const signedIn = { getUserId: vi.fn(async () => USER) };
const signedOut = { getUserId: vi.fn(async () => null) };

function callback(query: string, cookie?: string) {
  return new Request(`${ORIGIN}/api/calendar/google/callback${query}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

const CLEAR_COOKIE = "rp_google_oauth_state=; Path=/api/calendar/google; Max-Age=0";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "fake-client-id.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "fake-client-secret");
  vi.stubEnv("CALENDAR_TOKENS_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/calendar/google/connect", () => {
  it("signed out -> 307 to /sign-in on the request origin, no state cookie", async () => {
    const res = await handleGoogleConnect(new Request(`${ORIGIN}/api/calendar/google/connect`), signedOut);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/sign-in`);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("signed in -> 307 to Google with a fresh state, and the state cookie (dev: not Secure)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await handleGoogleConnect(new Request(`${ORIGIN}/api/calendar/google/connect`), signedIn);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const state = location.searchParams.get("state")!;
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/calendar/google/callback`);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie).toMatch(
      new RegExp(`^rp_google_oauth_state=${state}; Path=/api/calendar/google; Expires=[^;]+ GMT; Max-Age=600; HttpOnly; SameSite=lax$`),
    );
    expect(cookie).not.toContain("Secure");
  });

  it("production -> Secure cookie; APP_URL (then NEXT_PUBLIC_APP_URL) sets the redirect URI", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://old.example");
    let res = await handleGoogleConnect(new Request(`${ORIGIN}/api/calendar/google/connect`), signedIn);
    expect(res.headers.get("Set-Cookie")).toMatch(/; Max-Age=600; Secure; HttpOnly; SameSite=lax$/);
    expect(new URL(res.headers.get("Location")!).searchParams.get("redirect_uri")).toBe(
      "https://old.example/api/calendar/google/callback",
    );
    vi.stubEnv("APP_URL", "https://new.example");
    res = await handleGoogleConnect(new Request(`${ORIGIN}/api/calendar/google/connect`), signedIn);
    expect(new URL(res.headers.get("Location")!).searchParams.get("redirect_uri")).toBe(
      "https://new.example/api/calendar/google/callback",
    );
  });

  it("each call uses a new state", async () => {
    const a = await handleGoogleConnect(new Request(`${ORIGIN}/api/calendar/google/connect`), signedIn);
    const b = await handleGoogleConnect(new Request(`${ORIGIN}/api/calendar/google/connect`), signedIn);
    expect(new URL(a.headers.get("Location")!).searchParams.get("state")).not.toBe(
      new URL(b.headers.get("Location")!).searchParams.get("state"),
    );
  });
});

describe("GET /api/calendar/google/callback", () => {
  const settings = (google: string) => `${ORIGIN}/settings?google=${google}`;

  it("?error= -> settings?google=error", async () => {
    const res = await handleGoogleCallback(callback("?error=access_denied"), signedIn);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(settings("error"));
  });

  it("missing code or state -> invalid_callback", async () => {
    for (const q of ["", "?code=c", `?state=${STATE}`]) {
      const res = await handleGoogleCallback(callback(q, `rp_google_oauth_state=${STATE}`), signedIn);
      expect(res.headers.get("Location")).toBe(settings("invalid_callback"));
    }
  });

  it("state mismatch or missing state cookie -> invalid_state; no token exchange, no DB write", async () => {
    for (const cookie of [undefined, "rp_google_oauth_state=other", "other_cookie=x", `rp_google_oauth_state=${STATE}x`]) {
      const res = await handleGoogleCallback(callback(`?code=c&state=${STATE}`, cookie), signedIn);
      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toBe(settings("invalid_state"));
    }
    expect(m.exchangeGoogleCode).not.toHaveBeenCalled();
    expect(m.prisma.calendarLink.upsert).not.toHaveBeenCalled();
    expect(signedIn.getUserId).not.toHaveBeenCalled();
  });

  it("valid state but signed out -> unauthorized; no exchange", async () => {
    const res = await handleGoogleCallback(callback(`?code=c&state=${STATE}`, `rp_google_oauth_state=${STATE}`), signedOut);
    expect(res.headers.get("Location")).toBe(settings("unauthorized"));
    expect(m.exchangeGoogleCode).not.toHaveBeenCalled();
  });

  it("success -> tokens stored encrypted for the caller, state cookie cleared, settings?google=connected", async () => {
    const tokens = { accessToken: "ya29.fake-access", refreshToken: "1//fake-refresh", expiryDate: 1, tokenType: "Bearer", scope: "s" };
    m.exchangeGoogleCode.mockResolvedValue(tokens);
    m.prisma.calendarLink.upsert.mockResolvedValue({});
    const res = await handleGoogleCallback(
      callback(`?code=the-code&state=${STATE}`, `a=b; rp_google_oauth_state=${STATE}; c=d`),
      signedIn,
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(settings("connected"));
    expect(res.headers.get("Set-Cookie")).toBe(CLEAR_COOKIE);
    expect(m.exchangeGoogleCode).toHaveBeenCalledWith({
      code: "the-code",
      redirectUri: `${ORIGIN}/api/calendar/google/callback`,
    });
    const arg = m.prisma.calendarLink.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: USER });
    expect(arg.create.userId).toBe(USER);
    expect(JSON.stringify(arg)).not.toContain("ya29.fake-access");
    expect(decryptJson(arg.create.googleTokens)).toEqual(tokens);
    expect(decryptJson(arg.update.googleTokens)).toEqual(tokens);
  });

  it("exchange failure -> exchange_failed, state cookie still cleared, nothing stored", async () => {
    m.exchangeGoogleCode.mockRejectedValue(new Error("Google token exchange failed (400)"));
    const res = await handleGoogleCallback(callback(`?code=c&state=${STATE}`, `rp_google_oauth_state=${STATE}`), signedIn);
    expect(res.headers.get("Location")).toBe(settings("exchange_failed"));
    expect(res.headers.get("Set-Cookie")).toBe(CLEAR_COOKIE);
    expect(m.prisma.calendarLink.upsert).not.toHaveBeenCalled();
  });

  it("redirects to APP_URL's settings page when configured", async () => {
    vi.stubEnv("APP_URL", "https://new.example");
    const res = await handleGoogleCallback(callback("?error=x"), signedIn);
    expect(res.headers.get("Location")).toBe("https://new.example/settings?google=error");
  });

  it("default session lookup ensures the profile", async () => {
    m.getAppAuthUser.mockResolvedValue(null);
    const res = await handleGoogleCallback(callback(`?code=c&state=${STATE}`, `rp_google_oauth_state=${STATE}`));
    expect(res.headers.get("Location")).toBe(settings("unauthorized"));
    expect(m.getAppAuthUser).toHaveBeenCalledWith({ ensureProfile: true, withEmail: false });
  });
});
