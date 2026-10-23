# Troubleshooting

## Prayer Times Not Loading

- Check if location permissions are granted
- Verify API (AlAdhan) is reachable
- Check browser console for CORS or network errors
- Fallback: manually set lat/lng in settings

## Timezone Issues

- Ensure user profile has correct timezone
- DST transitions: times should auto-adjust
- If times seem wrong, clear cache and reload

## Auth Problems

- Auth is Clerk. Check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` and that they belong to the same Clerk instance.
- Social login: enable the provider (for example Google) in the Clerk dashboard.
- A `pk_test_` key means a Clerk development instance; use a production instance (`pk_live_`) on a public domain.
- Session expired: Clerk redirects to `/sign-in`.

## Database Problems

- `DATABASE_URL is not set`: the app and `npm run build` need it (any well-formed URL is enough for a build).
- Quran pages still work when the database is down: `src/lib/quran.ts` falls back to quranapi.pages.dev. Daily content and announcements answer `503` until the database is back.
- Supabase free projects pause after inactivity; restore the project in the Supabase dashboard.
- Saving a profile fails with a foreign key error on a fresh database: the `user_id` keys in `supabase/migrations` point at `auth.users`, which Clerk users are never in. See [db.md](db.md).

## Push Reminders Not Arriving

- `GET /api/push/dispatch` with the right `Authorization: Bearer <CRON_SECRET>` should return `{"ok":true,...}`. `401` means the secret does not match; `500` "Push config missing" means a VAPID variable is unset (the public key is read at build time, so redeploy after setting it); `503` means a database error (see the known blocker in [reminders.md](reminders.md)).
- Check that the "Reminders cron" workflow is running and its secrets are set.
- Restarting `npm run dev` regenerates VAPID keys; subscribe again after that.

## Calendar Sync

- Google: re-authorize if token expired
- ICS: regenerate secret if link compromised

## Build/Dev Errors

- Run `npm run lint` to catch type errors
- Clear `.next` cache: `rm -rf .next && npm run dev`
- Prisma issues: `npx prisma generate` after schema changes
