-- stats_v5_final_fix.sql
-- Run this in Supabase SQL Editor to ensure all versions (v2, v3, v5) are aligned.

-- ==========================================
-- 0. CLEANUP (Required if return types change)
-- ==========================================
DROP FUNCTION IF EXISTS public.get_global_user_stats_v5();
DROP FUNCTION IF EXISTS public.get_global_search_stats_v5();
DROP FUNCTION IF EXISTS public.get_global_ai_stats_v5();
DROP FUNCTION IF EXISTS public.get_global_sermon_counts_v5();

DROP FUNCTION IF EXISTS public.get_global_user_stats_v3();
DROP FUNCTION IF EXISTS public.get_global_search_stats_v3();
DROP FUNCTION IF EXISTS public.get_global_ai_stats_v3();
DROP FUNCTION IF EXISTS public.get_global_sermon_counts_v3();

DROP FUNCTION IF EXISTS public.get_global_user_stats_v2();
DROP FUNCTION IF EXISTS public.get_global_sermon_counts_v2();

-- ==========================================
-- 1. USER STATS (v5)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_global_user_stats_v5()
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
    total_users BIGINT;
    user_list JSONB;
BEGIN
    SELECT count(*) INTO total_users FROM public.user_profiles;
    SELECT jsonb_agg(u) INTO user_list FROM (
        SELECT 
            p.user_id, p.email, p.last_ip, COALESCE(p.last_seen, p.created_at) as last_seen,
            (SELECT count(*) FROM public.search_logs WHERE user_id = p.user_id) as search_count,
            (SELECT count(*) FROM public.ai_questions WHERE user_id = p.user_id) as ai_count,
            (SELECT count(*) FROM public.sermons WHERE user_id::text = p.user_id) as sermon_count,
            COALESCE(
                (SELECT device_info FROM public.search_logs WHERE user_id = p.user_id ORDER BY created_at DESC LIMIT 1),
                (SELECT device_info FROM public.ai_questions WHERE user_id = p.user_id ORDER BY created_at DESC LIMIT 1)
            ) as device
        FROM public.user_profiles p
        ORDER BY COALESCE(p.last_seen, p.created_at) DESC NULLS LAST LIMIT 100
    ) u;
    RETURN jsonb_build_object('total', total_users, 'users', COALESCE(user_list, '[]'::jsonb));
END;
$$;

-- ==========================================
-- 2. SEARCH STATS (v5)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_global_search_stats_v5()
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
    total_count BIGINT;
    top_terms JSONB;
BEGIN
    SELECT COUNT(*) INTO total_count FROM public.search_logs;
    SELECT jsonb_agg(t) INTO top_terms FROM (
        SELECT lower(trim(query)) as term, count(*) as count
        FROM public.search_logs GROUP BY lower(trim(query))
        ORDER BY count(*) DESC LIMIT 15
    ) t;
    RETURN jsonb_build_object('total', total_count, 'topTerms', COALESCE(top_terms, '[]'::jsonb));
END;
$$;

-- ==========================================
-- 3. AI STATS (v5)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_global_ai_stats_v5()
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
    total_count BIGINT;
    top_questions JSONB;
BEGIN
    SELECT COUNT(*) INTO total_count FROM public.ai_questions;
    SELECT jsonb_agg(t) INTO top_questions FROM (
        SELECT lower(trim(substring(question from 1 for 100))) as question, count(*) as count
        FROM public.ai_questions GROUP BY lower(trim(substring(question from 1 for 100)))
        ORDER BY count(*) DESC LIMIT 15
    ) t;
    RETURN jsonb_build_object('total', total_count, 'topQuestions', COALESCE(top_questions, '[]'::jsonb));
END;
$$;

-- ==========================================
-- 4. SERMON COUNTS (v5)
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_global_sermon_counts_v5()
RETURNS TABLE (user_id text, count bigint) SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id::text, count(*)::bigint
  FROM public.sermons s WHERE s.user_id IS NOT NULL
  GROUP BY s.user_id::text ORDER BY count(*) DESC;
END;
$$;

-- ==========================================
-- 5. ALIASES FOR BACKWARD COMPATIBILITY
-- ==========================================
-- v3 Aliases (Points to v5)
CREATE OR REPLACE FUNCTION public.get_global_user_stats_v3() RETURNS JSONB SECURITY DEFINER AS $$ BEGIN RETURN public.get_global_user_stats_v5(); END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_global_search_stats_v3() RETURNS JSONB SECURITY DEFINER AS $$ BEGIN RETURN public.get_global_search_stats_v5(); END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_global_ai_stats_v3() RETURNS JSONB SECURITY DEFINER AS $$ BEGIN RETURN public.get_global_ai_stats_v5(); END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_global_sermon_counts_v3() RETURNS TABLE (user_id text, count bigint) SECURITY DEFINER AS $$ BEGIN RETURN QUERY SELECT * FROM public.get_global_sermon_counts_v5(); END; $$ LANGUAGE plpgsql;

-- v2 Aliases (Points to v5)
CREATE OR REPLACE FUNCTION public.get_global_user_stats_v2() RETURNS JSONB SECURITY DEFINER AS $$ BEGIN RETURN public.get_global_user_stats_v5(); END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_global_sermon_counts_v2() RETURNS TABLE (user_id text, count bigint) SECURITY DEFINER AS $$ BEGIN RETURN QUERY SELECT * FROM public.get_global_sermon_counts_v5(); END; $$ LANGUAGE plpgsql;

-- ==========================================
-- 6. PERMISSIONS
-- ==========================================
GRANT EXECUTE ON FUNCTION public.get_global_user_stats_v5() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_search_stats_v5() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_ai_stats_v5() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_sermon_counts_v5() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_global_user_stats_v3() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_sermon_counts_v3() TO anon, authenticated, service_role;

-- ==========================================
-- 7. FORCE RELOAD
-- ==========================================
NOTIFY pgrst, 'reload schema';
