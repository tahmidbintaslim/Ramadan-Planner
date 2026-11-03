// Server-only helpers shared by the API route handlers in src/server/api/*.ts (framework-free: standard
// Request/Response only, so Vitest can call the handlers directly).
import "@tanstack/react-start/server-only";
import { AUTH_UNAVAILABLE_MESSAGE, INTERNAL_ERROR_MESSAGE } from "@/server/errors";

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

/** Public app origin for OAuth redirect URIs: `APP_URL` (old `NEXT_PUBLIC_APP_URL`), else the request origin. */
export function appBaseUrl(request: Request): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    new URL(request.url).origin
  );
}
