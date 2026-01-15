-- ============================================
-- DELETE ANONYMOUS USERS & LOGS
-- ============================================
-- This script removes users who haven't created an account (no email)
-- and wipes their history so they no longer appear in Stats.

-- 1. Create a temporary table of anonymous IDs to be deleted
CREATE TEMP TABLE anon_ids AS
SELECT user_id 
FROM user_profiles 
WHERE email IS NULL OR email = '' OR email = 'Anonymous';

-- 2. Delete their activity from all log tables
DELETE FROM search_logs WHERE user_id IN (SELECT user_id FROM anon_ids);
DELETE FROM ai_questions WHERE user_id IN (SELECT user_id FROM anon_ids);
DELETE FROM blog_views WHERE user_id IN (SELECT user_id FROM anon_ids);
DELETE FROM bible_reading_logs WHERE user_id IN (SELECT user_id FROM anon_ids);
DELETE FROM user_activity_logs WHERE user_id IN (SELECT user_id FROM anon_ids);

-- Handle sermons table which uses UUID type for user_id
DELETE FROM sermons 
WHERE user_id IN (
    SELECT user_id::uuid 
    FROM anon_ids 
    WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- 3. Finally, delete the profiles themselves
DELETE FROM user_profiles WHERE user_id IN (SELECT user_id FROM anon_ids);

-- 4. Clean up temp table
DROP TABLE anon_ids;

-- NOTE: If you also want to delete from auth.users (Supabase Auth tab),
-- you may need to do that manually in the Supabase UI or use an admin RPC.
