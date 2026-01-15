-- add_last_read_state_to_profiles.sql
-- Run this in Supabase SQL Editor to ensure cross-device sync works

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_read_state') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_read_state JSONB;
    END IF; 
END $$;

COMMENT ON COLUMN public.user_profiles.last_read_state IS 'Stores the last book and chapter read by the user for cross-device synchronization.';
