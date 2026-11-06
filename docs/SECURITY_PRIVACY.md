# Security & Privacy

## How user data is isolated

- Sign-in is handled by Clerk. The server derives the user's database ID from the Clerk user ID (`src/lib/auth/server.ts`); a client-supplied `user_id` is never trusted.
- Server queries run with full database access: Prisma connects with `DATABASE_URL` as the database owner and bypasses Postgres row-level security. RLS is on for every public table with no grants for `anon`/`authenticated` (`supabase/migrations/006_enable_rls.sql`), so the Supabase Data API exposes nothing; it does not protect this app.s own queries.
- Isolation therefore depends on every server query filtering by the signed-in user's ID (`where: { userId }` in Prisma). Review this on every new query.
- Guests' tracker data stays in their browser (`localStorage`) and is not sent to the server.

## Secrets

- `CLERK_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET` and `CALENDAR_TOKENS_ENCRYPTION_KEY` are server only. Never prefix them with `VITE_` (Vite ships `VITE_*` values to the browser) or the deprecated `NEXT_PUBLIC_`.
- Google OAuth tokens are encrypted at rest with AES-256-GCM (`src/lib/secure-json.ts`).
- ICS feed URLs contain a per-user secret; anyone with the link can read that user's reminder schedule. Only its SHA-256 is stored, responses are `private, no-store`, and revoking takes effect at once.
- `/api/push/dispatch` rejects calls without the cron secret.

## App

- Auth pages and logged-in pages: noindex.
- Log minimal detail; never log secrets or tokens. API routes return fixed error messages and keep details in server logs.
- Headers, CSP (Report-Only), rate limiting and the Vercel Firewall rules: see [security.md](security.md).
- Not done yet: a privacy policy, data export and account deletion.
