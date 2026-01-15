-- Secure RPC to fetch user profile by email (Admin Only)
CREATE OR REPLACE FUNCTION get_profile_by_email(target_email text)
RETURNS SETOF user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_is_admin boolean;
BEGIN
    -- 1. Check if caller is admin
    SELECT (TRIM(user_profiles.subscription_override) = 'admin') INTO caller_is_admin
    FROM user_profiles
    WHERE user_profiles.user_id::text = auth.uid()::text;

    -- 2. If admin, return matching profile(s)
    IF caller_is_admin THEN
        RETURN QUERY
        SELECT * FROM user_profiles 
        WHERE email ILIKE target_email;
    ELSE
        -- If not admin, return nothing (or only self if matches)
        RETURN QUERY
        SELECT * FROM user_profiles 
        WHERE email ILIKE target_email
        AND user_id = auth.uid()::text;
    END IF;
END;
$$;
