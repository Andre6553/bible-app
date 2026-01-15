-- =====================================================
-- COMPREHENSIVE FIX: Blog/For You Page Database Errors
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. blog_views - RLS policy fix
DROP POLICY IF EXISTS "Users can insert blog views" ON blog_views;
CREATE POLICY "Users can insert blog views" ON blog_views
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read blog views" ON blog_views;
CREATE POLICY "Users can read blog views" ON blog_views
FOR SELECT USING (true);

-- 2. user_devotionals - RLS policy fix
DROP POLICY IF EXISTS "Users can insert own devotionals" ON user_devotionals;
CREATE POLICY "Users can insert own devotionals" ON user_devotionals
FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own devotionals" ON user_devotionals;
CREATE POLICY "Users can update own devotionals" ON user_devotionals
FOR UPDATE USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can read own devotionals" ON user_devotionals;
CREATE POLICY "Users can read own devotionals" ON user_devotionals
FOR SELECT USING (auth.uid()::text = user_id::text);

-- 3. search_logs - Create table if missing
CREATE TABLE IF NOT EXISTS search_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    query TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read search logs" ON search_logs;
CREATE POLICY "Anyone can read search logs" ON search_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert search logs" ON search_logs;
CREATE POLICY "Users can insert search logs" ON search_logs FOR INSERT WITH CHECK (true);

-- 4. app_settings - Create table if missing
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
CREATE POLICY "Anyone can read app settings" ON app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert app settings" ON app_settings;
CREATE POLICY "Users can insert app settings" ON app_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update app settings" ON app_settings;
CREATE POLICY "Users can update app settings" ON app_settings FOR UPDATE USING (true);

-- 5. api_usage_logs - Create table if missing (with correct column types)
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT,
    status TEXT,
    model TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert api logs" ON api_usage_logs;
CREATE POLICY "Users can insert api logs" ON api_usage_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read api logs" ON api_usage_logs;
CREATE POLICY "Admins can read api logs" ON api_usage_logs FOR SELECT USING (true);

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- Done!
SELECT 'All RLS policies and missing tables fixed!' as result;
