# Database Documentation

## Tables

### daily_content (shared, cacheable)

- id, day (1–30)
- ayah_ar, ayah_bn, ayah_ref
- hadith_bn, hadith_ref
- dua_ar, dua_bn, dua_context
- day_task_bn, day_task_en
- checklist_template (jsonb)

### user_profiles (RLS: owner only)

- id (FK auth.users)
- locale (bn/en), timezone, lat, lng
- created_at, updated_at

### daily_logs (RLS: owner only)

- id, user_id, day
- prayers (jsonb), quran_progress (jsonb)
- checklist (jsonb), journal_text, my_dua
- created_at, updated_at

### reminder_rules (RLS: owner only)

- id, user_id
- type (sehri/iftar/prayer/taraweeh/tahajjud/custom)
- offset_minutes, channels (jsonb), enabled
- created_at

### push_subscriptions (RLS: owner only)

- id, user_id, endpoint, keys (jsonb)
- created_at

### calendar_links (RLS: owner only)

- id, user_id
- google_tokens (encrypted jsonb), ics_secret
- created_at

### announcements (admin managed)

- id, title_bn, title_en, body_bn, body_en
- start_at, end_at, created_at
