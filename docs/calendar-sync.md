# Calendar Sync

## ICS Sync (Implemented)

- Generate a private ICS link from Settings.
- Feed URL format: `/api/calendar/ics/:secret`
- Revoke clears the secret and invalidates existing subscriptions.

## Google Calendar OAuth Sync (Implemented)

Routes:

- `GET /api/calendar/google/connect`
- `GET /api/calendar/google/callback`

Settings actions:

- Connect Google Calendar
- Sync reminder events now
- Disconnect Google Calendar

Sync behavior:

- Events are synced from enabled reminder rules with `calendar` channel.
- Stale managed events are removed on subsequent sync.

## Required Environment Variables

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL` (recommended in production)
- `CALENDAR_TOKENS_ENCRYPTION_KEY` (32-byte key in base64 or 64-char hex)

## Google Cloud OAuth Setup

Authorized redirect URI:

- `https://yourdomain.com/api/calendar/google/callback`

Local development:

- `http://localhost:3000/api/calendar/google/callback`
