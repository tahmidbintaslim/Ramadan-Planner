# Reminders

## Implemented

- Reminder rules CRUD (type, label, offset, channels, enabled)
- Calendar channel via the private ICS feed
- Google Calendar OAuth sync (connect/sync/disconnect)
- Push subscription endpoint (`POST /api/push/subscribe`)
- Push dispatch endpoint (`GET /api/push/dispatch` for schedulers, `POST` for manual calls)
- Push delivery dedupe via `push_delivery_logs`

## How push dispatch works

1. A scheduler calls `GET /api/push/dispatch` every 5 minutes with `Authorization: Bearer <CRON_SECRET>`.
2. For each user with a push subscription and an enabled rule on the `push` channel, the route gets that day's prayer times for the user's saved location and time zone.
3. A rule's time is its base time (sehri, iftar, a prayer, Isha for Taraweeh, or 03:00 for Tahajjud) plus its offset, in the user's local time. `custom` rules have no base time and are never pushed.
4. A rule is due when that time fell in the last 10 minutes (`DUE_WINDOW_MS` in `src/lib/push-schedule.ts`: the 5-minute interval plus 5 minutes of grace for late scheduler runs). Times just before local midnight are matched by a run just after it.
5. Each send is recorded in `push_delivery_logs`; its unique (subscription, rule, scheduled time) index stops overlapping runs from sending twice. Subscriptions that the push service reports as gone (404/410) are deleted.

The schedule math is unit-tested in `src/lib/push-schedule.test.ts`.

## Push setup

Environment variables on the deployment:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: generate once with `npm run vapid:generate -- --subject=mailto:you@example.com` and keep them; new keys invalidate existing subscriptions. Next.js inlines `NEXT_PUBLIC_*` values at build time, so redeploy after setting or changing the public key
- `VAPID_SUBJECT` (e.g. `mailto:admin@example.com`)
- `CRON_SECRET`: required by `GET /api/push/dispatch`
- `PUSH_DISPATCH_SECRET` (optional): accepted by `POST` as the `x-cron-secret` header or a Bearer token; falls back to `CRON_SECRET`

Scheduler:

- `.github/workflows/reminders-cron.yml` runs every 5 minutes. Add the repository secrets `PUSH_DISPATCH_URL` (full URL of `/api/push/dispatch`) and `CRON_SECRET`. Without them the job exits without calling the app.
- GitHub may start scheduled runs several minutes late and disables schedules after 60 days without repository activity. Upstash QStash or Supabase `pg_cron` are alternatives that send the same request.
- `vercel.json` also schedules a daily call at 00:00 UTC; on the Hobby plan Vercel crons cannot run more often. Vercel sends `CRON_SECRET` automatically when it is set.

Check it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/push/dispatch
# {"ok":true,"checked":0,"delivered":0,"skippedUsers":0}
```

## Known blocker

In this repo's schema, `push_delivery_logs.user_id` references `auth.users` (Supabase Auth), not `user_profiles`. Clerk users are never in `auth.users`, so if the live database matches, the delivery log insert fails and dispatch answers 503 without sending. Point that foreign key at `user_profiles(id)` to unblock push.

## Timezone

All schedules are computed in the user's time zone and are DST-safe (`date-fns-tz`).
