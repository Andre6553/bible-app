-- fix_missing_increment_rpc.sql
-- Run this in Supabase SQL Editor to fix the 404 error during AI research

-- Create a generic increment function that works with singleton tables (like ai_quota)
-- It updates the row where id = 1
CREATE OR REPLACE FUNCTION public.increment(table_name text, column_name text, amount int DEFAULT 1)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET %I = COALESCE(%I, 0) + %L WHERE id = 1', table_name, column_name, column_name, amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.increment(text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment(text, text, int) TO anon;

-- Ensure the ai_quota row exists
INSERT INTO public.ai_quota (id, total_api_calls_today)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON FUNCTION public.increment IS 'Increments a specific column in a table for the row with id=1. Used for global counters like AI quotas.';
