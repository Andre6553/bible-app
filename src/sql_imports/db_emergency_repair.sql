-- EMERGENCY DATABASE REPAIR SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Ensure Promo Codes Table Exists (Fixes 404 on promo_codes)
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Populate Default Codes if Missing
INSERT INTO public.promo_codes (code, action, description)
VALUES 
    ('Master@12345', 'admin', 'Full Master Admin Access'),
    ('SUB', 'premium', '30 Days Premium Subscription'),
    ('Finger', 'tester_finger', 'Tester Access with Fingerprint reset'),
    ('Test', 'tester', 'Standard Tester Access'),
    ('ExpireMe', 'reset', 'Reset all overrides to free tier')
ON CONFLICT (code) DO NOTHING;

-- 3. Fix Infinite RLS Loop & Ensure Function Ownership
-- We explicitly set the owner to postgres (or service_role) to ensure SECURITY DEFINER works.
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  -- Master Override
  IF lower(auth.jwt() ->> 'email') = 'andre.ecprint@gmail.com' THEN
    RETURN true;
  END IF;

  -- Check DB Role (Bypassing RLS because of SECURITY DEFINER + postgres owner)
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND subscription_override IN ('admin', 'tester')
  );
END;
$$;

-- FORCE OWNER TO POSTGRES / DASHBOARD USER to ensure BypassRLS works
ALTER FUNCTION public.is_admin_jwt() OWNER TO postgres;

-- 4. Fix RLS Policies for Promo Codes (Allow Testers)
DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins and Testers can view promo codes" ON public.promo_codes;

CREATE POLICY "Admins and Testers can view promo codes" 
ON public.promo_codes
TO authenticated
USING (
    public.is_admin_jwt() -- Uses the fixed function
);

-- 5. Enable RLS on Promo Codes
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
