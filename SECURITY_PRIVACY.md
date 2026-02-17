# Security & Privacy

## Supabase

- Enforce RLS on all user-owned tables.
- Never trust client-provided user_id.
- Service role key never shipped to browser.

## App

- Auth pages and logged-in pages: noindex
- Minimal logging; never log secrets/tokens
- Rate-limit sensitive endpoints (subscribe, calendar sync)
