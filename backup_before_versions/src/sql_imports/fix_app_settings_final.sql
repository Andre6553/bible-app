-- fix_app_settings_final.sql
-- Run this in Supabase SQL Editor

-- 1. Ensure table exists with all columns
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safely add description column if it was somehow skipped
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'description') THEN
        ALTER TABLE public.app_settings ADD COLUMN description TEXT;
    END IF; 
END $$;

-- 3. Populate missing settings with defaults
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('admin_new_user_email_enabled', 'false', 'Enable admin alert for new users'),
    ('user_welcome_email_enabled', 'false', 'Enable welcome email for new users'),
    ('email_template_welcome_body', 'Dear New Member, Welcome to Omni Bible!', 'Body content for welcome email'),
    ('email_template_admin_body', 'Hello Andre, A new user has just joined Omni Bible!', 'Body content for admin notification'),
    ('last_notified_user_count', '0', 'Last user count used for notifications')
ON CONFLICT (key) DO NOTHING;

-- 4. Enable RLS and Policies (Bypass if already exists)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON public.app_settings;
CREATE POLICY "Allow read access to all authenticated users"
ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.app_settings;
CREATE POLICY "Allow update access to authenticated users"
ON public.app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.app_settings;
CREATE POLICY "Allow insert access to authenticated users"
ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
