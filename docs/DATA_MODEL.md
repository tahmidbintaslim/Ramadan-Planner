# Data Model (Supabase)

## Shared Content

- daily_content (day 1..30): ayah/hadith/dua + day task + checklist template

## User Data (RLS required)

- user_profiles: locale, timezone, location prefs
- daily_logs: prayers, quran progress, checklist completion, journal text, my dua
- reminder_rules: type, offsets, channels, enabled
- push_subscriptions: endpoint keys per device
- calendar_links: google tokens (encrypted), ics secret key
- announcements (admin): BN/EN title/body, start/end
