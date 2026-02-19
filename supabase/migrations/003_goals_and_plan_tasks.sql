-- Ramadan Planner: Prayer Goals + Plan Tasks

-- ============================================================
-- 1. Prayer Goals (user-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS prayer_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  target_unit TEXT NOT NULL DEFAULT 'times',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prayer_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prayer goals" ON prayer_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prayer goals" ON prayer_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prayer goals" ON prayer_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prayer goals" ON prayer_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_prayer_goals_user ON prayer_goals(user_id);

-- ============================================================
-- 2. Plan Tasks (user-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan tasks" ON plan_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan tasks" ON plan_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan tasks" ON plan_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan tasks" ON plan_tasks
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_plan_tasks_user ON plan_tasks(user_id);
