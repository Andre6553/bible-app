-- =====================================================
-- FIX: Inductive Studies RLS Policy Errors
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Enable RLS on the table
ALTER TABLE inductive_studies ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can create their own studies" ON inductive_studies;
DROP POLICY IF EXISTS "Users can view their own studies" ON inductive_studies;
DROP POLICY IF EXISTS "Users can update their own studies" ON inductive_studies;
DROP POLICY IF EXISTS "Users can delete their own studies" ON inductive_studies;

-- 3. Create comprehensive policies

-- INSERT: Authenticated users can create rows where user_id matches their own ID
CREATE POLICY "Users can create their own studies"
ON inductive_studies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

-- SELECT: Users can view only their own studies
CREATE POLICY "Users can view their own studies"
ON inductive_studies
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

-- UPDATE: Users can update only their own studies
CREATE POLICY "Users can update their own studies"
ON inductive_studies
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id::text);

-- DELETE: Users can delete only their own studies
CREATE POLICY "Users can delete their own studies"
ON inductive_studies
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id::text);

-- 4. Verify/Fix policies for 'verses' table if relevant to the error context (optional but safely included)
-- Sometimes 'verses' deletions might propagate or be related, but primary error is 'inductive_studies'.

SELECT 'Fixed RLS policies for inductive_studies' as result;
