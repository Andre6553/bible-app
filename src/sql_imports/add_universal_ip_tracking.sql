-- add_universal_ip_tracking.sql
-- Run this in Supabase SQL Editor

-- 1. Add ip_address to activity log tables
DO $$ 
BEGIN 
    -- Search logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE public.search_logs ADD COLUMN ip_address TEXT;
    END IF; 

    -- AI questions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_questions' AND column_name = 'ip_address') THEN
        ALTER TABLE public.ai_questions ADD COLUMN ip_address TEXT;
    END IF; 

    -- Bible reading logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bible_reading_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE public.bible_reading_logs ADD COLUMN ip_address TEXT;
    END IF; 

    -- Blog views
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blog_views' AND column_name = 'ip_address') THEN
        ALTER TABLE public.blog_views ADD COLUMN ip_address TEXT;
    END IF; 

    -- User activity logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_activity_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE public.user_activity_logs ADD COLUMN ip_address TEXT;
    END IF; 

    -- User Profiles (Add ip_address as well for consistency)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'ip_address') THEN
        ALTER TABLE public.user_profiles ADD COLUMN ip_address TEXT;
    END IF; 
END $$;

-- 2. Update user_profiles trigger/sync (Optional, but good for data integrity)
-- We can set ip_address = last_ip for existing records
UPDATE public.user_profiles SET ip_address = last_ip WHERE ip_address IS NULL AND last_ip IS NOT NULL;

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';
