// Server-only: holds the service-role key. Start's import protection fails the client build if it leaks.
import "@tanstack/react-start/server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server Supabase client for the planner tables. Auth is Clerk, not Supabase Auth, so no session cookies
 * are read or written: callers MUST scope every query by the signed-in user's id (the service-role key
 * bypasses row-level security).
 */
export async function createClient() {
    // SUPABASE_URL is the server name; the VITE_/NEXT_PUBLIC_ names are cutover fallbacks.
    const url =
        process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Prefer using the Supabase service role key on the server for full DB access.
    // Fall back to the publishable key if the service role key is not set.
    const serverKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!url) {
        throw new Error("Supabase is not configured: set SUPABASE_URL (or VITE_SUPABASE_URL).");
    }
    if (!serverKey) {
        throw new Error(
            "Supabase is not configured: set SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
        );
    }

    return createSupabaseClient(url, serverKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
