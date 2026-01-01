-- Create a function to atomically promote a user to super user status based on app settings
-- This prevents race conditions and ensures the logic is "bulletproof"

CREATE OR REPLACE FUNCTION auto_promote_user(target_id TEXT)
RETURNS TEXT AS $$
DECLARE
    auto_super_on BOOLEAN;
    rate_limit_off BOOLEAN;
    current_list JSONB;
    final_list_text TEXT;
BEGIN
    -- 1. Fetch settings (Handles missing rows gracefully)
    SELECT (value = 'true') INTO auto_super_on FROM app_settings WHERE key = 'super_users_auto';
    SELECT (value = 'false') INTO rate_limit_off FROM app_settings WHERE key = 'blog_rate_limit_enabled';

    -- Defaults if rows don't exist
    IF auto_super_on IS NULL THEN auto_super_on := FALSE; END IF;
    IF rate_limit_off IS NULL THEN rate_limit_off := FALSE; END IF;

    -- 2. Determine if we should promote
    -- BULLETPROOF PLAN: Upgrade if autoSuper is on AND rateLimit is off
    -- We also respect the standalone autoSuper toggle
    IF (auto_super_on IS TRUE) THEN
        
        -- Get current list
        SELECT value INTO final_list_text FROM app_settings WHERE key = 'super_users';
        
        -- Handle missing or invalid JSON
        BEGIN
            IF final_list_text IS NULL OR final_list_text = '' THEN
                current_list := '[]'::jsonb;
            ELSE
                current_list := final_list_text::jsonb;
            END IF;
        EXCEPTION WHEN others THEN
            current_list := '[]'::jsonb;
        END;

        -- 3. Append if not already in the list
        IF NOT (current_list ? target_id) THEN
            UPDATE app_settings 
            SET value = (current_list || jsonb_build_array(target_id))::text,
                updated_at = NOW()
            WHERE key = 'super_users';
            
            -- If row didn't exist, insert it
            IF NOT FOUND THEN
                INSERT INTO app_settings (key, value, updated_at)
                VALUES ('super_users', jsonb_build_array(target_id)::text, NOW());
            END IF;
            
            RETURN 'PROMOTED';
        ELSE
            RETURN 'ALREADY_SUPER';
        END IF;
    END IF;
    
    RETURN 'SKIPPED';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to everyone (public) since guest users need to trigger it
GRANT EXECUTE ON FUNCTION auto_promote_user(TEXT) TO public;
GRANT EXECUTE ON FUNCTION auto_promote_user(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION auto_promote_user(TEXT) TO authenticated;
