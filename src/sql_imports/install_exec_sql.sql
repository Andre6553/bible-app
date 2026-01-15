-- ================================================================
-- ONE-TIME SETUP: Remote Admin SQL Execution
-- This function allows the AI Agent (using the Service Role Key) 
-- to run SQL scripts for you, so you never have to do it again.
-- ================================================================

CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
