-- ==========================================
-- FIX RLS ACCESS FOR TESTERS & ADMINS
-- ==========================================

-- Redefine the core security function to genericize "Admin" access.
-- Previously: It ONLY checked the JWT email.
-- Now: It checks JWT Email OR Database Role ('admin' or 'tester').

-- We make it SECURITY DEFINER so it can inspect user_profiles
-- without getting blocked by user_profiles' own RLS policies.

CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean
SECURITY DEFINER -- Runs with privileges of the creator (postgres), bypassing RLS
SET search_path = public
LANGUAGE plpgsql STABLE -- Stable because it reads from the DB now
AS $$
BEGIN
  -- 1. Master Override (Hardcoded Email / Super Admin)
  IF lower(auth.jwt() ->> 'email') = 'andre.ecprint@gmail.com' THEN
    RETURN true;
  END IF;

  -- 2. Check Database Role (Admin or Tester)
  -- We check if the current user has 'admin' or 'tester' in their profile
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND subscription_override IN ('admin', 'tester')
  );
END;
$$;

-- Verify it exists
SELECT count(*) as "Function Updated" 
FROM pg_proc 
WHERE proname = 'is_admin_jwt';
