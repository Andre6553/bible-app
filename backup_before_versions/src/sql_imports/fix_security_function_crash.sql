-- FIX SECURITY FUNCTION CRASH (Type Mismatch)
-- The function "is_admin_jwt" crashes for Testers because user_profiles.user_id is TEXT but auth.uid() is UUID.
-- This script fixes it by casting BOTH to text so they can be compared safely.

CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  -- 1. Master Override (Fast Path - No DB Query)
  IF lower(auth.jwt() ->> 'email') = 'andre.ecprint@gmail.com' THEN
    RETURN true;
  END IF;

  -- 2. Check Database Role (Robust Path)
  -- We cast BOTH sides to ::text to avoid "operator does not exist: text = uuid" error.
  -- This works whether the column is UUID or TEXT.
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id::text = auth.uid()::text
    AND subscription_override IN ('admin', 'tester')
  );
END;
$$;

-- Ensure Postgres owns it to bypass RLS
ALTER FUNCTION public.is_admin_jwt() OWNER TO postgres;

-- Verify it exists
SELECT count(*) as "Function Fixed" 
FROM pg_proc 
WHERE proname = 'is_admin_jwt';
