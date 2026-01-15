-- check if updated_at exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Create or replace the function to update the timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger if it doesn't exist (droppping first to be safe/idempotent for this script)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Also ensure the RPC 'update_user_subscription_status' exists and is correct
-- This reconstructs it to be safe and use parameters correctly
CREATE OR REPLACE FUNCTION update_user_subscription_status(target_user_id UUID, new_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Update the user profile
    -- mapping 'reset' to free/null defaults if handled by logic, but usually the UI passes 'premium', 'admin', etc.
    -- If new_status is 'reset', we clear the override.
    
    IF new_status = 'reset' THEN
        UPDATE user_profiles
        SET 
            subscription_override = NULL,
            subscription_tier = 'free',
            updated_at = now()
        WHERE user_id = target_user_id;
    ELSE
        UPDATE user_profiles
        SET 
            subscription_override = new_status,
            -- If admin/tester, we might not strictly change tier, but usually we do for consistency
            subscription_tier = CASE WHEN new_status = 'premium' THEN 'premium' ELSE subscription_tier END,
            updated_at = now()
        WHERE user_id = target_user_id;
    END IF;

    -- Return the updated record
    SELECT to_jsonb(u) INTO result FROM user_profiles u WHERE user_id = target_user_id;
    
    RETURN result;
END;
$$;
