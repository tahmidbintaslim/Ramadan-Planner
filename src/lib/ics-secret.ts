// Server-only: the ICS feed secret is a bearer credential in the feed URL. Only its SHA-256 is stored
// (calendar_links.ics_secret_hash, migration 008); the plaintext is shown to the user once, when created.
import "@tanstack/react-start/server-only";
import { createHash, randomBytes } from "node:crypto";

/** Lowercase hex SHA-256 of the UTF-8 secret. Must match the backfill in supabase/migrations/008. */
export function hashIcsSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** A new 128-bit secret as 32 hex chars (the same shape the app always issued). */
export function newIcsSecret(): string {
  return randomBytes(16).toString("hex");
}
