-- Secure RPC to fetch user profiles (Admin Only)
-- Bypasses RLS recursion issues by running as Security Definer
CREATE OR REPLACE FUNCTION get_user_profiles_secure(
    user_ids text[]
)
RETURNS TABLE (
    user_id text,
    email text,
    subscription_tier text,
    subscription_override text,
    subscription_expiry timestamptz,
    last_ip text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_is_admin boolean;
BEGIN
    -- 1. Check if caller is admin
    -- qualified with table name to avoid ambiguity with output parameter
    SELECT (TRIM(user_profiles.subscription_override) = 'admin') INTO caller_is_admin
    FROM user_profiles
    WHERE user_profiles.user_id::text = auth.uid()::text;

    -- 2. If admin, return requested profiles
    IF caller_is_admin THEN
        RETURN QUERY
        SELECT 
            up.user_id, 
            up.email, 
            up.subscription_tier, 
            up.subscription_override, 
            up.subscription_expiry,
            up.last_ip
        FROM user_profiles up
        WHERE up.user_id = ANY(user_ids);
        
    ELSE
        -- If not admin, return ONLY their own profile (if in the list)
        RETURN QUERY
        SELECT 
            up.user_id, 
            up.email, 
            up.subscription_tier, 
            up.subscription_override, 
            up.subscription_expiry,
            up.last_ip
        FROM user_profiles up
        WHERE up.user_id = auth.uid()::text 
        AND up.user_id = ANY(user_ids);
    END IF;
END;
$$;
