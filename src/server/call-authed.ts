// Shared by server-function wrappers. No server-only imports here.
import { isUnauthorized } from "./errors";

/**
 * Signed out keeps the old `{ ok: false, error: "unauthorized" }` contract. Any other failure (offline, the auth
 * backend's 503, a masked server error) also resolves as `{ ok: false, error: "request_failed" }`: every caller
 * already rolls back and shows its error on `!ok`, whereas a throw left ticks shown as saved, kept the plan on its
 * skeleton, or (inside a React transition) replaced the whole page with the route error screen.
 */
export async function callAuthed<T extends { ok: boolean }>(
  call: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await call();
  } catch (error) {
    if (isUnauthorized(error)) return { ok: false, error: "unauthorized" };
    return { ok: false, error: "request_failed" };
  }
}
