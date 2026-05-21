-- Add study guide and personal notes support to reading plans
-- Run in Supabase SQL Editor

ALTER TABLE reading_plans
    ADD COLUMN IF NOT EXISTS study_guide_en TEXT,
    ADD COLUMN IF NOT EXISTS study_guide_af TEXT;

ALTER TABLE user_reading_plans
    ADD COLUMN IF NOT EXISTS day_notes JSONB NOT NULL DEFAULT '{}'::jsonb;

SELECT 'Reading plans study migration applied' AS result;
