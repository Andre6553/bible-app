-- ============================================
-- FIX: app_config RLS Policy for Admin Access
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable RLS on app_config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read app_config" ON public.app_config;
DROP POLICY IF EXISTS "Admins can read app_config" ON public.app_config;
DROP POLICY IF EXISTS "Admins can insert app_config" ON public.app_config;
DROP POLICY IF EXISTS "Admins can update app_config" ON public.app_config;
DROP POLICY IF EXISTS "Admins can delete app_config" ON public.app_config;

-- Policy 1: Anyone can READ app_config (needed for subscription price display)
CREATE POLICY "Anyone can read app_config"
ON public.app_config
FOR SELECT
TO authenticated, anon
USING (true);

-- Policy 2: Only Admins can INSERT
CREATE POLICY "Admins can insert app_config"
ON public.app_config
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()::text
        AND subscription_override = 'admin'
    )
);

-- Policy 3: Only Admins can UPDATE
CREATE POLICY "Admins can update app_config"
ON public.app_config
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()::text
        AND subscription_override = 'admin'
    )
);

-- Policy 4: Only Admins can DELETE
CREATE POLICY "Admins can delete app_config"
ON public.app_config
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid()::text
        AND subscription_override = 'admin'
    )
);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'app_config';
