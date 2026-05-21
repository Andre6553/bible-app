-- Plan Intelligence Schema
-- Tracks plan behavior and learned study profiles for recommendations.
-- Run in Supabase Dashboard -> SQL Editor (optional; service also uses app_settings fallback)

CREATE TABLE IF NOT EXISTS user_plan_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'plan_viewed',
        'plan_enrolled',
        'plan_day_complete',
        'plan_completed',
        'plan_paused',
        'plan_abandoned',
        'plan_catalog_click'
    )),
    plan_id UUID REFERENCES reading_plans(id) ON DELETE SET NULL,
    plan_slug TEXT,
    plan_category TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_plan_events_user_created
    ON user_plan_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_plan_profiles (
    user_id TEXT PRIMARY KEY,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE user_plan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plan_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own plan events" ON user_plan_events;
CREATE POLICY "Users view own plan events"
    ON user_plan_events FOR SELECT TO authenticated
    USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users insert own plan events" ON user_plan_events;
CREATE POLICY "Users insert own plan events"
    ON user_plan_events FOR INSERT TO authenticated
    WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users view own plan profile" ON user_plan_profiles;
CREATE POLICY "Users view own plan profile"
    ON user_plan_profiles FOR SELECT TO authenticated
    USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users upsert own plan profile" ON user_plan_profiles;
CREATE POLICY "Users upsert own plan profile"
    ON user_plan_profiles FOR ALL TO authenticated
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

SELECT 'Plan intelligence schema created' AS result;
