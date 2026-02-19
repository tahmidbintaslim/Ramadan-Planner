-- Ramadan Planner: Admin Users + Push Delivery Logs

-- ============================================================
-- 1. Admin users (stronger role model)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own admin row" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage admin users" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. Push delivery logs (dedupe and audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID REFERENCES reminder_rules(id) ON DELETE CASCADE NOT NULL,
  trigger_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, rule_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_user_schedule
  ON push_delivery_logs(user_id, scheduled_for);

ALTER TABLE push_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own delivery logs" ON push_delivery_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage delivery logs" ON push_delivery_logs
  FOR ALL USING (auth.role() = 'service_role');
