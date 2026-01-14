-- SUPABASE DIAGNOSTIC SCRIPT
-- RUN THIS IN YOUR SQL EDITOR

-- 1. CHECK FOR TRIGGERS (These can cause loops!)
SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    action_timing AS timing, 
    event_manipulation AS event, 
    action_statement AS definition
FROM information_schema.triggers
WHERE event_object_schema = 'public';

-- 2. CHECK FOR ACTIVE LOCKS (Is a transaction stuck?)
SELECT 
    pid, 
    now() - query_start AS duration, 
    query, 
    state 
FROM pg_stat_activity 
WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%';

-- 3. THE "FORCE UNLOCK" (Safety Test)
-- This disables RLS temporarily on the two most critical tables.
-- If the app starts working after this, we KNOW it's a security rule problem.
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.verse_highlights DISABLE ROW LEVEL SECURITY;

-- 4. CLEANUP FUNCTIONS
DROP FUNCTION IF EXISTS public.check_is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_jwt() CASCADE;
