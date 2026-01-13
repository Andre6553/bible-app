-- add_ip_tracking.sql
-- Run this in Supabase SQL Editor

-- 0. Re-declare check_is_admin with robust casting (safety first)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    lower(auth.jwt() ->> 'email') = 'andre.ecprint@gmail.com' OR
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id::text = auth.uid()::text 
      AND (subscription_override = 'admin' OR subscription_tier = 'admin')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Add missing columns to user_profiles
-- last_ip: Tracks current user location for the dashboard
-- last_seen: Tracks the last time they logged in or refreshed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_ip') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_ip TEXT;
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_seen') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_seen TIMESTAMPTZ DEFAULT NOW();
    END IF; 
END $$;

-- 2. Create payment_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payment_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    status TEXT DEFAULT 'success',
    amount TEXT,
    provider TEXT DEFAULT 'payfast',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies for payment_history
DROP POLICY IF EXISTS "Users can view their own payment history" ON public.payment_history;
CREATE POLICY "Users can view their own payment history" 
ON public.payment_history FOR SELECT 
USING (auth.uid()::text = user_id::text OR public.check_is_admin());

DROP POLICY IF EXISTS "Users can insert their own payment logs" ON public.payment_history;
CREATE POLICY "Users can insert their own payment logs" 
ON public.payment_history FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

-- 5. Update user_profiles policy to ensure users can update their own last_ip
DROP POLICY IF EXISTS "Users can only access their own profile" ON public.user_profiles;
CREATE POLICY "Users can only access their own profile" 
ON public.user_profiles 
FOR ALL 
USING (
    auth.uid()::text = user_id::text OR 
    public.check_is_admin()
)
WITH CHECK (
    auth.uid()::text = user_id::text OR 
    public.check_is_admin()
);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';

