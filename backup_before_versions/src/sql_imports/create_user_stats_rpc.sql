-- Global User Activity Stats (Bypassing RLS)
-- Returns total count and list of active users with device info

CREATE OR REPLACE FUNCTION get_global_user_stats()
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    total_users BIGINT;
    user_list JSONB;
BEGIN
    -- 1. Get True Total Count
    SELECT count(*) INTO total_users FROM user_profiles;

    -- 2. Get Top 100 Active Users
    SELECT jsonb_agg(u) INTO user_list
    FROM (
        SELECT 
            p.user_id,
            p.email,
            COALESCE(p.last_seen, p.created_at) as last_seen,
            -- Activity Counts
            (SELECT count(*) FROM search_logs WHERE user_id = p.user_id) as search_count,
            (SELECT count(*) FROM ai_questions WHERE user_id = p.user_id) as ai_count,
            (SELECT count(*) FROM sermons WHERE user_id = p.user_id) as sermon_count,
            -- Latest Device Info (Try search logs first, then AI logs)
            COALESCE(
                (SELECT device_info FROM search_logs WHERE user_id = p.user_id ORDER BY created_at DESC LIMIT 1),
                (SELECT device_info FROM ai_questions WHERE user_id = p.user_id ORDER BY created_at DESC LIMIT 1)
            ) as device
        FROM user_profiles p
        ORDER BY COALESCE(p.last_seen, p.created_at) DESC NULLS LAST
        LIMIT 100
    ) u;

    RETURN jsonb_build_object(
        'total', total_users,
        'users', COALESCE(user_list, '[]'::jsonb)
    );
END;
$$;
