# Security & Privacy

## How user data is isolated

- Sign-in is handled by Clerk. The server derives the user's database ID from the Clerk user ID (`src/lib/auth/server.ts`); a client-supplied `user_id` is never trusted.
- Server queries run with full database access: Prisma connects with `DATABASE_URL`, and `supabase-js` uses `SUPABASE_SERVICE_ROLE_KEY`. Both bypass Postgres row-level security, so the RLS policies in `supabase/migrations` do not protect this app's queries.
- Isolation therefore depends on every server query filtering by the signed-in user's ID (`where: { userId }` in Prisma, `.eq("user_id", …)` in supabase-js). Review this on every new query.
- Guests' tracker data stays in their browser (`localStorage`) and is not sent to the server.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET` and `CALENDAR_TOKENS_ENCRYPTION_KEY` are server only. Never prefix them with `NEXT_PUBLIC_`.
- Google OAuth tokens are encrypted at rest with AES-256-GCM (`src/lib/secure-json.ts`).
- ICS feed URLs contain a per-user secret; anyone with the link can read that user's reminder schedule. Revoking clears the secret, but CDN-cached responses can be served for up to an hour plus a 6-hour stale window.
- `/api/push/dispatch` rejects calls without the cron secret.

## App

- Auth pages and logged-in pages: noindex.
- Log minimal detail; never log secrets or tokens. API routes return fixed error messages and keep details in server logs.
- Not done yet: rate limiting on sensitive endpoints (push subscribe, calendar sync), a privacy policy, data export and account deletion.
