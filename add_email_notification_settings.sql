-- Add email notification settings to app_settings
INSERT INTO app_settings (key, value, updated_at)
VALUES 
    ('admin_new_user_email_enabled', 'false', timezone('utc'::text, now())),
    ('user_welcome_email_enabled', 'false', timezone('utc'::text, now())),
    ('last_notified_user_count', '0', timezone('utc'::text, now()))
ON CONFLICT (key) DO NOTHING;

-- Ensure user_profiles has created_at
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
        -- Initialize for existing users
        UPDATE user_profiles SET created_at = COALESCE(last_seen, timezone('utc'::text, now())) WHERE created_at IS NULL;
    END IF;
END $$;
