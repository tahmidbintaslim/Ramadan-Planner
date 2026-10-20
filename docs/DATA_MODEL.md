# Data Model

PostgreSQL hosted on Supabase. Tables are accessed through Prisma and, for planner data, through supabase-js with the service role key (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## Shared content

- daily_content (day 1..30): ayah/hadith/dua + day task + checklist template
- quran_surahs, quran_ayahs, quran_reciters
- hadith, hadith editions

## User data (scoped to the signed-in user in application code)

- user_profiles: locale, timezone, location prefs. `id` is derived from the Clerk user ID.
- daily_logs: prayers, quran progress, checklist completion, journal text, my dua
- prayer_goals, plan_tasks: goals and the pre-Ramadan plan
- reminder_rules: type, offsets, channels, enabled
- push_subscriptions: endpoint keys per device
- push_delivery_logs: one row per sent push, used to avoid duplicates
- calendar_links: google tokens (encrypted), ics secret key

## Admin

- announcements: BN/EN title/body, start/end
- admin_users: extra admins besides `ADMIN_EMAILS`
