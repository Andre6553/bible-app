-- Plan pool migration
-- When YOU delete a plan, the NEW plan created for you is copied into a shared pool
-- so other users can discover it in "For You". Your deleted plan is NOT shared.
-- Run in Supabase Dashboard -> SQL Editor (after subject_plans_migration.sql)

ALTER TABLE reading_plans
    ADD COLUMN IF NOT EXISTS is_pool BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS original_owner_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reading_plans_pool
    ON reading_plans(subject, created_at DESC)
    WHERE is_pool = true AND is_active = true;

-- Public catalog read: active, non-personal, non-pool (curated plans)
DROP POLICY IF EXISTS "Anyone can read active plans" ON reading_plans;
CREATE POLICY "Anyone can read active plans"
    ON reading_plans FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND COALESCE(is_personal, false) = false
        AND COALESCE(is_pool, false) = false
    );

-- Shared AI pool: any signed-in user can read active pool plans
DROP POLICY IF EXISTS "Anyone can read active pool plans" ON reading_plans;
CREATE POLICY "Anyone can read active pool plans"
    ON reading_plans FOR SELECT
    TO authenticated
    USING (is_active = true AND is_pool = true);

-- Users can update only their own personal plans (soft-delete on remove)
DROP POLICY IF EXISTS "Users can update own personal plans" ON reading_plans;
CREATE POLICY "Users can update own personal plans"
    ON reading_plans FOR UPDATE
    TO authenticated
    USING (is_personal = true AND created_by_user_id = auth.uid()::text)
    WITH CHECK (is_personal = true AND created_by_user_id = auth.uid()::text);

-- Users can insert a pool COPY of a plan they own (the fresh plan after delete/regenerate)
DROP POLICY IF EXISTS "Users can insert pool copy of own plan" ON reading_plans;
CREATE POLICY "Users can insert pool copy of own plan"
    ON reading_plans FOR INSERT
    TO authenticated
    WITH CHECK (
        is_pool = true
        AND is_personal = false
        AND created_by_user_id IS NULL
        AND original_owner_id = auth.uid()::text
        AND category = 'personal'
    );

SELECT 'Plan pool migration applied' AS result;
