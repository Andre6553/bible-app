-- Reading Plans Schema
-- Run in Supabase Dashboard -> SQL Editor

-- Catalog of static reading plans
CREATE TABLE IF NOT EXISTS reading_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title_en TEXT NOT NULL,
    title_af TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_af TEXT NOT NULL,
    study_guide_en TEXT,
    study_guide_af TEXT,
    duration_days INT NOT NULL CHECK (duration_days > 0),
    category TEXT NOT NULL CHECK (category IN ('devotional', 'whole_bible', 'nt', 'topic')),
    readings JSONB NOT NULL DEFAULT '[]'::jsonb,
    cover_emoji TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_plans_slug ON reading_plans(slug);
CREATE INDEX IF NOT EXISTS idx_reading_plans_active_sort ON reading_plans(is_active, sort_order);

-- User enrollments and progress
CREATE TABLE IF NOT EXISTS user_reading_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id UUID NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMPTZ,
    current_day INT NOT NULL DEFAULT 1 CHECK (current_day >= 1),
    completed_days INT[] NOT NULL DEFAULT '{}',
    day_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_reading_plans_user ON user_reading_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reading_plans_user_status ON user_reading_plans(user_id, status);

-- One active enrollment per user per plan
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reading_plans_one_active
    ON user_reading_plans(user_id, plan_id)
    WHERE status = 'active';

-- RLS
ALTER TABLE reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reading_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active plans" ON reading_plans;
CREATE POLICY "Anyone can read active plans"
    ON reading_plans FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own enrollments" ON user_reading_plans;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON user_reading_plans;
DROP POLICY IF EXISTS "Users can update own enrollments" ON user_reading_plans;
DROP POLICY IF EXISTS "Users can delete own enrollments" ON user_reading_plans;

CREATE POLICY "Users can view own enrollments"
    ON user_reading_plans FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own enrollments"
    ON user_reading_plans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own enrollments"
    ON user_reading_plans FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own enrollments"
    ON user_reading_plans FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id::text);

SELECT 'Reading plans schema created' AS result;
