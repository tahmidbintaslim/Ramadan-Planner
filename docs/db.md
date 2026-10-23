# Database Documentation

PostgreSQL hosted on Supabase. `prisma/schema.prisma` was introspected from the live database. User-owned tables are protected by application code, not RLS: the app connects with full access (Prisma, and supabase-js with the service role key), and every query filters by the signed-in user's ID.

Known schema gap: `supabase/migrations` and parts of `schema.prisma` still point `user_id` foreign keys at Supabase's `auth.users`, which Clerk users are never added to. On the live schema this affects `admin_users.user_id` and `push_delivery_logs.user_id`; on a fresh database built from `supabase/migrations` it affects every user table. These keys should reference `user_profiles(id)`.

## Tables

### daily_content (shared, cacheable)

- id, day (1–30)
- ayah_ar, ayah_bn, ayah_en, ayah_ref
- hadith_ar, hadith_bn, hadith_en, hadith_ref
- dua_ar, dua_bn, dua_en, dua_context
- day_task_bn, day_task_en
- checklist_template (jsonb)

### user_profiles (owner only, scoped in code)

- id: UUID derived from the Clerk user ID (`src/lib/auth/server.ts`)
- display_name, locale (bn/en), timezone, latitude, longitude, location_label
- created_at, updated_at

### daily_logs (owner only, scoped in code)

- id, user_id, day, log_date
- prayers (jsonb), quran_para, quran_surah, quran_ayah, quran_pages
- checklist (jsonb), journal_text, my_dua, day_task_done
- created_at, updated_at
- unique (user_id, day)

### reminder_rules (owner only, scoped in code)

- id, user_id
- type (sehri/iftar/fajr/dhuhr/asr/maghrib/isha/taraweeh/tahajjud/custom)
- label, offset_minutes, channels (jsonb: push, calendar), enabled
- created_at, updated_at

### push_subscriptions (owner only, scoped in code)

- id, user_id, endpoint, keys (jsonb)
- created_at

### push_delivery_logs (written by /api/push/dispatch)

- id, user_id, subscription_id, rule_id, trigger_type, scheduled_for, sent_at
- unique (subscription_id, rule_id, scheduled_for) prevents duplicate sends

### calendar_links (owner only, scoped in code)

- id, user_id
- google_tokens (AES-256-GCM encrypted jsonb), ics_secret
- created_at, updated_at

### announcements (admin managed)

- id, title_bn, title_en, body_bn, body_en
- start_at, end_at, created_at
