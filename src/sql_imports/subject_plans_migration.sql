-- Subject Plans Migration
-- Adds AI-generated, per-user "subject" reading plans (Faith, Hope, Anxiety, etc.)
-- Run in Supabase Dashboard -> SQL Editor

-- 1) Extend reading_plans with personal-plan fields
ALTER TABLE reading_plans
    ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS generation_model TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 2) Allow 'personal' category alongside the existing curated categories
ALTER TABLE reading_plans DROP CONSTRAINT IF EXISTS reading_plans_category_check;
ALTER TABLE reading_plans ADD CONSTRAINT reading_plans_category_check
    CHECK (category IN ('devotional', 'whole_bible', 'nt', 'topic', 'personal'));

-- 3) Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_reading_plans_personal_owner
    ON reading_plans(created_by_user_id)
    WHERE is_personal = true;

CREATE INDEX IF NOT EXISTS idx_reading_plans_subject
    ON reading_plans(subject)
    WHERE is_personal = true;

-- 4) Update RLS so users can read curated plans (existing) PLUS their own personal plans.
DROP POLICY IF EXISTS "Anyone can read active plans" ON reading_plans;
CREATE POLICY "Anyone can read active plans"
    ON reading_plans FOR SELECT
    TO anon, authenticated
    USING (is_active = true AND COALESCE(is_personal, false) = false);

DROP POLICY IF EXISTS "Users can read own personal plans" ON reading_plans;
CREATE POLICY "Users can read own personal plans"
    ON reading_plans FOR SELECT
    TO authenticated
    USING (is_personal = true AND created_by_user_id = auth.uid()::text);

-- 5) Users can insert their own personal plans (server-side validated category=personal).
DROP POLICY IF EXISTS "Users can insert own personal plans" ON reading_plans;
CREATE POLICY "Users can insert own personal plans"
    ON reading_plans FOR INSERT
    TO authenticated
    WITH CHECK (
        is_personal = true
        AND created_by_user_id = auth.uid()::text
        AND category = 'personal'
    );

-- 6) Users can update / delete only their own personal plans (e.g. to regenerate or remove).
DROP POLICY IF EXISTS "Users can update own personal plans" ON reading_plans;
CREATE POLICY "Users can update own personal plans"
    ON reading_plans FOR UPDATE
    TO authenticated
    USING (is_personal = true AND created_by_user_id = auth.uid()::text)
    WITH CHECK (is_personal = true AND created_by_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own personal plans" ON reading_plans;
CREATE POLICY "Users can delete own personal plans"
    ON reading_plans FOR DELETE
    TO authenticated
    USING (is_personal = true AND created_by_user_id = auth.uid()::text);

SELECT 'Subject plans migration applied' AS result;
