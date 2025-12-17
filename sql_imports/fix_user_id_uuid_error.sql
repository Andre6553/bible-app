-- Fix: Convert user_id from UUID to TEXT to support client-side generated IDs
-- The app uses custom IDs like 'user_xxx', which are not UUIDs.

-- 1. Drop the foreign key constraint that requires auth.users
ALTER TABLE app_errors 
DROP CONSTRAINT IF EXISTS app_errors_user_id_fkey;

-- 2. Change the column type to text
ALTER TABLE app_errors 
ALTER COLUMN user_id TYPE TEXT;
