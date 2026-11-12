-- Read-only catalogue assertions after applying 20261112160000_for_you_v2.sql.
-- Submit the WHOLE file through exec_sql; any failed assertion raises an error.
DO $$
DECLARE v_table text; v_fn regprocedure;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['for_you_preferences','for_you_content','for_you_slots','for_you_feedback'] LOOP
    IF to_regclass('public.'||v_table) IS NULL THEN RAISE EXCEPTION 'Missing For You table: %',v_table; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||v_table) AND relrowsecurity) THEN
      RAISE EXCEPTION 'RLS missing: %',v_table; END IF;
    IF has_table_privilege('anon','public.'||v_table,'SELECT') OR has_table_privilege('authenticated','public.'||v_table,'INSERT')
      OR has_table_privilege('authenticated','public.'||v_table,'UPDATE') OR has_table_privilege('authenticated','public.'||v_table,'DELETE') THEN
      RAISE EXCEPTION 'Unexpected direct table access: %',v_table; END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
    'public.for_you_get_preferences()'::regprocedure,
    'public.for_you_patch_preferences(integer,text,text)'::regprocedure,
    'public.for_you_claim_content(text,text,text,text,boolean)'::regprocedure,
    'public.for_you_complete_content(uuid,text,jsonb)'::regprocedure,
    'public.for_you_release_content(uuid)'::regprocedure,
    'public.for_you_set_feedback(uuid,text,boolean)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon',v_fn,'EXECUTE') OR NOT has_function_privilege('authenticated',v_fn,'EXECUTE') THEN
      RAISE EXCEPTION 'Incorrect For You RPC privilege: %',v_fn; END IF;
  END LOOP;
END; $$;
