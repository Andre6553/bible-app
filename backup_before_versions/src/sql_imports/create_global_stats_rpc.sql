-- 1. Global Search Stats (Top Terms & Total Count)
CREATE OR REPLACE FUNCTION get_global_search_stats()
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count BIGINT;
    top_terms JSONB;
BEGIN
    -- Get Total Count
    SELECT COUNT(*) INTO total_count FROM search_logs;

    -- Get Top 10 Terms
    SELECT jsonb_agg(t) INTO top_terms
    FROM (
        SELECT lower(trim(query)) as term, count(*) as count
        FROM search_logs
        GROUP BY lower(trim(query))
        ORDER BY count(*) DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'total', total_count,
        'topTerms', COALESCE(top_terms, '[]'::jsonb)
    );
END;
$$;

-- 2. Global AI Stats (Top Questions & Total Count)
CREATE OR REPLACE FUNCTION get_global_ai_stats()
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count BIGINT;
    top_questions JSONB;
BEGIN
    -- Get Total Count
    SELECT COUNT(*) INTO total_count FROM ai_questions;

    -- Get Top 10 Questions
    SELECT jsonb_agg(t) INTO top_questions
    FROM (
        SELECT lower(trim(substring(question from 1 for 100))) as question, count(*) as count
        FROM ai_questions
        GROUP BY lower(trim(substring(question from 1 for 100)))
        ORDER BY count(*) DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'total', total_count,
        'topQuestions', COALESCE(top_questions, '[]'::jsonb)
    );
END;
$$;
