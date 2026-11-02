// Shared by server-function wrappers (client and server side). No server-only imports here.

/** Message the auth middleware throws for a signed-out call (with HTTP 401). */
export const UNAUTHORIZED_MESSAGE = "Unauthorized";

/** Message the auth middleware throws when the auth backend fails (with HTTP 503). */
export const AUTH_UNAVAILABLE_MESSAGE = "auth_unavailable";

/**
 * True only for the auth middleware's signed-out rejection, however Start surfaces it:
 * - a client RPC call rethrows the deserialized `Error("Unauthorized")`;
 * - a call made on the server (SSR, loaders) rejects with the same Error directly;
 * - a raw `Response` with status 401 (e.g. if the body was not a serialized Start payload).
 * Every other error (network, 503 auth_unavailable, bugs) is NOT matched and must be rethrown.
 */
export function isUnauthorized(error: unknown): boolean {
  if (typeof Response !== "undefined" && error instanceof Response) {
    return error.status === 401;
  }
  if (typeof error === "object" && error !== null) {
    const { message, status, statusCode } = error as {
      message?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    if (message === UNAUTHORIZED_MESSAGE) return true;
    if (status === 401 || statusCode === 401) return true;
  }
  return false;
}
