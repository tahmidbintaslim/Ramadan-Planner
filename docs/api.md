# API Docs

Conventions:

- JSON response: `{ ok: true, data }` or `{ ok: false, error }`
- Validation errors: `400`
- Auth errors: `401`
- Forbidden: `403`
- Unexpected: `500`

Implemented endpoints:

- `GET /api/timings`
- `GET /api/ramadan`
- `GET /api/ramadan-timetable`
- `GET /api/quran`
- `GET /api/daily-content?day=1..30`

Reminders/Integrations:

- `POST /api/push/subscribe`
- `POST /api/push/dispatch` (cron/secret protected)
- `GET /api/calendar/ics/:secret`
- `GET /api/calendar/google/connect`
- `GET /api/calendar/google/callback`

Announcements:

- `GET /api/announcements`
- `POST /api/announcements` (admin only)
- `PATCH /api/announcements/:id` (admin only)
- `DELETE /api/announcements/:id` (admin only)
