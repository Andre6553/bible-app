-- inspect_guest_migration: unverified guests return JSON, not an exception (avoids HTTP 400 in the browser).
-- migrate_guest_data still requires a verified claim and raises if missing.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112120000_inspect_guest_no_raise.sql

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

  IF NOT EXISTS (
    SELECT 1 FROM public.legacy_guest_migration_claims
    WHERE guest_id = p_guest_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('verification_required', true);
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','empty','count',0));
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', v_tbl)
        INTO v_count
        USING p_guest_id;
      IF v_count > 0 THEN
        v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','found','count', v_count));
      ELSE
        v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','empty','count', 0));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','failed','count',0,'error', SQLERRM));
    END;
  END LOOP;

  RETURN v_out;
END;
$$;
