# Reminders

## Implemented

- Reminder rules CRUD (type, offset, channels, enabled)
- Calendar channel via ICS feed
- Google Calendar OAuth sync (connect/sync/disconnect)
- Push subscription endpoint (`/api/push/subscribe`)
- Push dispatch endpoint for cron (`/api/push/dispatch`)
- Push delivery dedupe via `push_delivery_logs`

## Push Setup

Required env vars:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:admin@example.com`)
- `PUSH_DISPATCH_SECRET` (send as `x-cron-secret` to dispatch endpoint)

## Timezone

All schedules are computed in user timezone and DST-safe.
