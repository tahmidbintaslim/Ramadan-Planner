// Shared by server-function wrappers. No server-only imports here.
import { isUnauthorized } from "./errors";

/**
 * The old actions returned `{ ok: false, error: "unauthorized" }` when signed out; keep that contract.
 * Maps the auth middleware's signed-out rejection to that result and rethrows everything else.
 */
export async function callAuthed<T extends { ok: boolean }>(
  call: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await call();
  } catch (error) {
    if (isUnauthorized(error)) return { ok: false, error: "unauthorized" };
    throw error;
  }
}
