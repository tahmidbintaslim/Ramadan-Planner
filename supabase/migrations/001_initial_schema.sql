-- Ramadan Planner: Initial Schema
-- Run this in Supabase SQL editor

-- ============================================================
-- 1. Daily Content (shared, cacheable, no RLS needed for reads)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day INTEGER NOT NULL UNIQUE CHECK (day >= 1 AND day <= 30),
  
  -- Ayah
  ayah_ar TEXT NOT NULL DEFAULT '',
  ayah_bn TEXT NOT NULL DEFAULT '',
  ayah_en TEXT DEFAULT '',
  ayah_ref TEXT NOT NULL DEFAULT '',
  
  -- Hadith
  hadith_ar TEXT DEFAULT '',
  hadith_bn TEXT NOT NULL DEFAULT '',
  hadith_en TEXT DEFAULT '',
  hadith_ref TEXT NOT NULL DEFAULT '',
  
  -- Dua
  dua_ar TEXT NOT NULL DEFAULT '',
  dua_bn TEXT NOT NULL DEFAULT '',
  dua_en TEXT DEFAULT '',
  dua_context TEXT DEFAULT '',
  
  -- Day task
  day_task_bn TEXT DEFAULT '',
  day_task_en TEXT DEFAULT '',
  
  -- Checklist template (JSON array of task strings)
  checklist_template JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public read access for daily content
ALTER TABLE daily_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read daily content" ON daily_content
  FOR SELECT USING (true);

-- Only service role can modify
CREATE POLICY "Service role can manage daily content" ON daily_content
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. User Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT DEFAULT '',
  locale TEXT DEFAULT 'bn' CHECK (locale IN ('bn', 'en')),
  timezone TEXT DEFAULT 'Asia/Dhaka',
  latitude DOUBLE PRECISION DEFAULT 23.8103,  -- Dhaka default
  longitude DOUBLE PRECISION DEFAULT 90.4125,
  location_label TEXT DEFAULT 'ঢাকা, বাংলাদেশ',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 3. Daily Logs (user-scoped tracking data)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 30),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Salah tracking (JSON: { fajr: bool, dhuhr: bool, ... })
  prayers JSONB DEFAULT '{}'::jsonb,
  
  -- Quran tracking
  quran_para INTEGER DEFAULT 0,
  quran_surah TEXT DEFAULT '',
  quran_ayah INTEGER DEFAULT 0,
  quran_pages INTEGER DEFAULT 0,
  
  -- Checklist (JSON array of completed task IDs/strings)
  checklist JSONB DEFAULT '[]'::jsonb,
  
  -- Journal
  journal_text TEXT DEFAULT '',
  my_dua TEXT DEFAULT '',
  
  -- Day task completed
  day_task_done BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, day)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs" ON daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs" ON daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs" ON daily_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_daily_logs_user_day ON daily_logs(user_id, day);
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, log_date);

-- ============================================================
-- 4. Reminder Rules
-- ============================================================
CREATE TABLE IF NOT EXISTS reminder_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sehri', 'iftar', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'taraweeh', 'tahajjud', 'custom')),
  label TEXT DEFAULT '',
  offset_minutes INTEGER DEFAULT -15,  -- negative = before event
  channels JSONB DEFAULT '["push"]'::jsonb,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminders" ON reminder_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders" ON reminder_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" ON reminder_rules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON reminder_rules
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_reminder_rules_user ON reminder_rules(user_id);

-- ============================================================
-- 5. Push Subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

-- ============================================================
-- 6. Calendar Links
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_tokens JSONB DEFAULT NULL,  -- encrypted in app layer
  ics_secret TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

ALTER TABLE calendar_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar links" ON calendar_links
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 7. Announcements (admin managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title_bn TEXT NOT NULL,
  title_en TEXT DEFAULT '',
  body_bn TEXT NOT NULL,
  body_en TEXT DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements" ON announcements
  FOR SELECT USING (
    start_at <= NOW() AND (end_at IS NULL OR end_at >= NOW())
  );

CREATE POLICY "Service role can manage announcements" ON announcements
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 8. Auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
