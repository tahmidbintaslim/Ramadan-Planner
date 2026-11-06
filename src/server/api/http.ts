// Server-only helpers shared by the API route handlers in src/server/api/*.ts (framework-free: standard
// Request/Response only, so Vitest can call the handlers directly).
import "@tanstack/react-start/server-only";
import { AUTH_UNAVAILABLE_MESSAGE, INTERNAL_ERROR_MESSAGE } from "@/server/errors";

/** True for an IANA zone the runtime knows (`Intl.DateTimeFormat` accepts it). */
export function isValidTimeZoneParam(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isValidDateParam(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d;
}

/** `NextResponse.json(body, init)` equivalent. */
export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

/**
 * Last-resort guard for a route handler. The Next handlers let unexpected errors become a bare 500; here they
 * are logged server-side and answered with a fixed body, so no Prisma/Clerk/host text can reach the client.
 */
export async function guarded(tag: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    console.error(`[${tag}] unhandled error`, error);
    if (error instanceof Error && error.message === AUTH_UNAVAILABLE_MESSAGE) {
      return json(
        { ok: false, error: AUTH_UNAVAILABLE_MESSAGE },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return json(
      { ok: false, error: INTERNAL_ERROR_MESSAGE },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/** Value of one cookie from the request's Cookie header (`request.cookies.get(name)?.value` in Next). */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

/** Set-Cookie value in the same attribute form Next's `response.cookies.set(name, value, options)` produced. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (typeof options.maxAge === "number") {
    if (options.maxAge > 0) parts.push(`Expires=${new Date(Date.now() + options.maxAge * 1000).toUTCString()}`);
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

/**
 * `NextResponse.redirect(url)` equivalent: 307 with an absolute Location. Built by hand (not
 * `Response.redirect`, whose headers are immutable and whose default status is 302) so cookies can be set.
 */
export function redirect(url: URL | string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: String(url) });
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 307, headers });
}

/** Canonical production origin, used when no app/site URL is configured. */
export const CANONICAL_APP_URL = "https://ramadanplanner.tahmid.space";

/**
 * Public app origin for OAuth redirect URIs: `APP_URL` (old `NEXT_PUBLIC_APP_URL`), else `SITE_URL` (old
 * `NEXT_PUBLIC_SITE_URL`). In production it never comes from the request: the Host header is
 * client-controlled, so a spoofed Host must not choose where Google sends the code. Without any of those
 * variables production uses CANONICAL_APP_URL; only development/test falls back to the request origin.
 */
export function appBaseUrl(request: Request): string {
  const configured = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]
    .map((value) => value?.trim())
    .find((value): value is string => !!value);
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return CANONICAL_APP_URL;
  return new URL(request.url).origin;
}
