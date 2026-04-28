-- FIX: ai_cache 403 Forbidden (RLS policy)
-- Run this in Supabase SQL Editor.
-- This enables authenticated clients to read and upsert cache rows.

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- Clean old conflicting policies (safe if they do not exist)
DROP POLICY IF EXISTS "Users can read ai cache" ON public.ai_cache;
DROP POLICY IF EXISTS "Users can insert ai cache" ON public.ai_cache;
DROP POLICY IF EXISTS "Users can update ai cache" ON public.ai_cache;

-- Allow authenticated app users to read cache
CREATE POLICY "Users can read ai cache"
ON public.ai_cache
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated app users to insert cache rows
CREATE POLICY "Users can insert ai cache"
ON public.ai_cache
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated app users to update cache rows
CREATE POLICY "Users can update ai cache"
ON public.ai_cache
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

SELECT 'ai_cache RLS policies applied' AS result;
