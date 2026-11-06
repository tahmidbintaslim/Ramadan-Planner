# API Docs

Conventions:

- JSON response: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Messages are fixed strings; internal error details stay in server logs.
- Older routes (push, announcement writes) still return `{ ok: false, error: "<message or code>" }`.
- `/api/quran` returns the surah list, a surah or the reciter list directly (no `ok` wrapper) on success.
- Validation errors: `400`
- Auth errors: `401`
- Forbidden: `403`
- Database or upstream unavailable: `503` (`Cache-Control: no-store`)
- Unexpected: `500`

Implemented endpoints:

- `GET /api/timings`
- `GET /api/ramadan`
- `GET /api/ramadan-timetable`
- `GET /api/quran`, `?surah=1..114`, `?reciters=true`: reads the database and falls back to quranapi.pages.dev when it is empty or unreachable; `503` only when both fail
- `GET /api/daily-content?day=1..30`: `404` when the day has no content, `503` when the database is unreachable

Reminders/Integrations:

- `POST /api/push/subscribe` (signed in)
- `GET /api/push/dispatch` (requires `Authorization: Bearer <CRON_SECRET>`; called by the scheduler, see [reminders.md](reminders.md))
- `POST /api/push/dispatch` (requires `PUSH_DISPATCH_SECRET` or `CRON_SECRET` as `x-cron-secret` or a Bearer token)
- `GET /api/calendar/ics/:secret`
- `GET /api/calendar/google/connect`
- `GET /api/calendar/google/callback`

Card donations (see [donations.md](donations.md)):

- `POST /api/donations/checkout` (guests welcome; same-origin only): `{ amount, currency: "usd"|"gbp"|"eur"|"bdt", frequency: "once"|"monthly", locale?: "bn"|"en" }` -> `{ ok: true, url }`. `400` with `issue` (`amount_min`, `amount_max`, `amount_invalid`, `monthly_unsupported`, `invalid_request`), `429` when rate-limited, `503` when Stripe is not configured
- `POST /api/stripe/webhook` (CSRF-exempt; `stripe-signature` verified): `400` bad signature, `503` without `STRIPE_WEBHOOK_SECRET`, `500` on a database error so Stripe retries
- `GET /api/donations/summary`: anonymous totals per month and currency plus a donor count, cached 5 minutes
- `POST /api/donations/portal` (same-origin only): `{ sessionId: "cs_..." }` -> `{ ok: true, url }` for a monthly donation's Stripe customer portal; `404` for anything else

Announcements:

- `GET /api/announcements` (`503` when the database is unreachable)
- `POST /api/announcements` (admin only)
- `PATCH /api/announcements/:id` (admin only)
- `DELETE /api/announcements/:id` (admin only)
