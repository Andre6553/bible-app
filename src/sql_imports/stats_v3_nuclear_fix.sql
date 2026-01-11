-- stats_v3_nuclear_fix.sql
-- Run this in Supabase SQL Editor to fix all dashboard 404 errors

-- 1. Create User Stats v3
CREATE OR REPLACE FUNCTION get_global_user_stats_v3()
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
    total_users BIGINT;
    user_list JSONB;
BEGIN
    SELECT count(*) INTO total_users FROM user_profiles;
    SELECT jsonb_agg(u) INTO user_list FROM (
        SELECT 
            p.user_id, p.email, COALESCE(p.last_seen, p.created_at) as last_seen,
            (SELECT count(*) FROM search_logs WHERE user_id = p.user_id) as search_count,
            (SELECT count(*) FROM ai_questions WHERE user_id = p.user_id) as ai_count,
            (SELECT count(*) FROM sermons WHERE user_id = p.user_id) as sermon_count,
            COALESCE(
                (SELECT device_info FROM search_logs WHERE user_id = p.user_id ORDER BY created_at DESC LIMIT 1),
                (SELECT device_info FROM ai_questions WHERE user_id = p.user_id ORDER BY created_at DESC LIMIT 1)
            ) as device
        FROM user_profiles p
        ORDER BY COALESCE(p.last_seen, p.created_at) DESC NULLS LAST LIMIT 100
    ) u;
    RETURN jsonb_build_object('total', total_users, 'users', COALESCE(user_list, '[]'::jsonb));
END;
$$;

-- 2. Create Search Stats v3
CREATE OR REPLACE FUNCTION get_global_search_stats_v3()
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
    total_count BIGINT;
    top_terms JSONB;
BEGIN
    SELECT COUNT(*) INTO total_count FROM search_logs;
    SELECT jsonb_agg(t) INTO top_terms FROM (
        SELECT lower(trim(query)) as term, count(*) as count
        FROM search_logs GROUP BY lower(trim(query))
        ORDER BY count(*) DESC LIMIT 15
    ) t;
    RETURN jsonb_build_object('total', total_count, 'topTerms', COALESCE(top_terms, '[]'::jsonb));
END;
$$;

-- 3. Create AI Stats v3
CREATE OR REPLACE FUNCTION get_global_ai_stats_v3()
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
    total_count BIGINT;
    top_questions JSONB;
BEGIN
    SELECT COUNT(*) INTO total_count FROM ai_questions;
    SELECT jsonb_agg(t) INTO top_questions FROM (
        SELECT lower(trim(substring(question from 1 for 100))) as question, count(*) as count
        FROM ai_questions GROUP BY lower(trim(substring(question from 1 for 100)))
        ORDER BY count(*) DESC LIMIT 15
    ) t;
    RETURN jsonb_build_object('total', total_count, 'topQuestions', COALESCE(top_questions, '[]'::jsonb));
END;
$$;

-- 4. Create Sermon Counts v3
CREATE OR REPLACE FUNCTION get_global_sermon_counts_v3()
RETURNS TABLE (user_id uuid, count bigint) SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, count(*)::bigint
  FROM sermons s WHERE s.user_id IS NOT NULL
  GROUP BY s.user_id ORDER BY count(*) DESC;
END;
$$;

-- 5. Give Permissions
GRANT EXECUTE ON FUNCTION get_global_user_stats_v3() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_global_search_stats_v3() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_global_ai_stats_v3() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_global_sermon_counts_v3() TO anon, authenticated, service_role;
