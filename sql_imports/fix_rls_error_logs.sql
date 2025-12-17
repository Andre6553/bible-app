-- Fix: Allow Anonymous users (guests) to save and view error logs
-- ROBUST VERSION: Drops all potential conflicting policies first

-- 1. Ensure RLS is enabled
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;

-- 2. Drop policies (handling likely names to avoid conflicts)
DROP POLICY IF EXISTS "Enable insert for all users" ON app_errors;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON app_errors;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON app_errors;

DROP POLICY IF EXISTS "Allow Public Insert" ON app_errors;
DROP POLICY IF EXISTS "Allow Public Select" ON app_errors;
DROP POLICY IF EXISTS "Allow Public Delete" ON app_errors;

DROP POLICY IF EXISTS "public_insert" ON app_errors;
DROP POLICY IF EXISTS "public_select" ON app_errors;
DROP POLICY IF EXISTS "public_delete" ON app_errors;

-- 3. Re-create Permissive Policies

-- INSERT: Allow anyone to log an error
CREATE POLICY "Allow Public Insert" 
ON app_errors FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- SELECT: Allow anyone to view logs (relying on client PIN)
CREATE POLICY "Allow Public Select" 
ON app_errors FOR SELECT 
TO anon, authenticated
USING (true);

-- DELETE: Allow anyone to delete logs
CREATE POLICY "Allow Public Delete" 
ON app_errors FOR DELETE 
TO anon, authenticated
USING (true);
