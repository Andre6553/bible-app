-- add_free_mode_setting.sql
-- Run in Supabase SQL Editor when migrations are not applied automatically.

-- Ensure admin check exists (matches app Stats / RLS patterns)
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

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, description)
VALUES (
    'free_mode',
    'false',
    'When true, all logged-in users receive premium access; subscription UI is hidden'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Remove legacy permissive write policies if present
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.app_settings;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.app_settings;
DROP POLICY IF EXISTS "Users can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users can update app settings" ON public.app_settings;

-- Everyone (including anon) can read app settings
DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
CREATE POLICY "public_read_app_settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Only admins can insert or update settings
DROP POLICY IF EXISTS "admin_insert_app_settings" ON public.app_settings;
CREATE POLICY "admin_insert_app_settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "admin_update_app_settings" ON public.app_settings;
CREATE POLICY "admin_update_app_settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.check_is_admin())
WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "admin_delete_app_settings" ON public.app_settings;
CREATE POLICY "admin_delete_app_settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.check_is_admin());
