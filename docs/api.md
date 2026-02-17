# API Docs

Conventions:

- JSON response: { ok: true, data } or { ok: false, error: { code, message } }
- Validation errors: 400
- Auth errors: 401
- Forbidden: 403
- Unexpected: 500

Endpoints (planned):

- /api/timings (GET)
- /api/logs (GET/POST)
- /api/reminders (GET/POST)
- /api/push/subscribe (POST)
- /api/calendar/google/\* (OAuth)
- /api/calendar/ics/:secret.ics (GET)
