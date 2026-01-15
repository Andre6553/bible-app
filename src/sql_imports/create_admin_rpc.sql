-- Secure RPC for Admin User Management
-- Allows an App Admin to update another user's subscription/role

CREATE OR REPLACE FUNCTION update_user_subscription_status(
    target_user_id text,
    new_status text, -- 'admin', 'premium', 'tester', 'tester_finger', or null/empty for reset
    expiry_date timestamptz DEFAULT null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with Service Role privileges
AS $$
DECLARE
    caller_is_admin boolean;
    updates json;
BEGIN
    -- 1. Security Check: Is the caller an admin?
    -- We check the user_profiles table for the current user (auth.uid())
    SELECT (subscription_override = 'admin') INTO caller_is_admin
    FROM user_profiles
    WHERE user_id = auth.uid()::text;

    IF caller_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can perform this action.';
    END IF;

    -- 2. Validate Input
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Target User ID is required';
    END IF;

    -- 3. Determine Updates based on new_status
    IF new_status = 'admin' THEN
        UPDATE user_profiles 
        SET subscription_override = 'admin'
        WHERE user_id = target_user_id;
        
    ELSIF new_status = 'premium' THEN
        UPDATE user_profiles 
        SET subscription_override = 'premium',
            subscription_tier = 'premium',
            subscription_expiry = COALESCE(expiry_date, now() + interval '30 days')
        WHERE user_id = target_user_id;

    ELSIF new_status = 'tester' THEN
        UPDATE user_profiles 
        SET subscription_override = 'tester'
        WHERE user_id = target_user_id;

    ELSIF new_status = 'tester_finger' THEN
        UPDATE user_profiles 
        SET subscription_override = 'tester_finger'
        WHERE user_id = target_user_id;

    ELSE -- Reset / Standard
        UPDATE user_profiles 
        SET subscription_override = null,
            subscription_tier = 'free',
            subscription_expiry = null
        WHERE user_id = target_user_id;
    END IF;

    RETURN json_build_object('success', true);
END;
$$;
