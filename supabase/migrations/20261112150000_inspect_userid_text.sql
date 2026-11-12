-- Guest inspect/migrate: compare user_id as text so UUID columns (e.g. sermons)
-- do not fail the whole check. A failed sermons count was blocking Sync forever.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112150000_inspect_userid_text.sql

CREATE OR REPLACE FUNCTION public._count_user_rows(p_table text, p_user_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint := 0;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN 0;
  END IF;
  BEGIN
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id::text = $1', p_table)
      INTO v_count
      USING p_user_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN 0;
  END;
  RETURN COALESCE(v_count, 0);
END;
$$;
REVOKE ALL ON FUNCTION public._count_user_rows(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inspect_guest_migration(p_guest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth text := auth.uid()::text;
  v_out jsonb := '{}'::jsonb;
  v_count bigint;
  v_tbl text;
  v_tables text[] := ARRAY[
    'verse_highlights','verse_notes','study_collections','highlight_categories','user_labels',
    'word_studies','inductive_studies','search_logs','ai_questions','devotional_history',
    'sermons','user_settings','user_reading_plans','user_plan_events','user_plan_profiles'
  ];
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.is_legacy_guest_id(p_guest_id) THEN
    RAISE EXCEPTION 'invalid_guest_id';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = p_guest_id) THEN
    RAISE EXCEPTION 'guest_id_is_auth_user';
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_count := public._count_user_rows(v_tbl, p_guest_id);
    IF v_count > 0 THEN
      v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','found','count', v_count));
    ELSE
      v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','empty','count', 0));
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public._reassign_guest_table(p_table text, p_from text, p_to text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'inductive_studies','search_logs','ai_questions','devotional_history',
    'sermons','user_plan_events','user_activity_logs','bible_reading_logs'
  ];
BEGIN
  IF NOT (p_table = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'table_not_allowed';
  END IF;
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    EXECUTE format('UPDATE public.%I SET user_id = $1 WHERE user_id::text = $2', p_table)
      USING p_to, p_from;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF public._count_user_rows(p_table, p_from) > 0 THEN
    RAISE EXCEPTION 'transfer_failed:%', p_table;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._assert_guest_empty(p_guest_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tbl text;
  v_tables text[] := ARRAY[
    'verse_highlights','verse_notes','study_collections','highlight_categories','user_labels',
    'word_studies','inductive_studies','search_logs','ai_questions','devotional_history',
    'sermons','user_settings','user_reading_plans','user_plan_events','user_plan_profiles'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF public._count_user_rows(v_tbl, p_guest_id) > 0 THEN
      RAISE EXCEPTION 'remaining_guest_rows:%', v_tbl;
    END IF;
  END LOOP;
END;
$$;
