-- Guest leftover: empty ids can be retired; admins can approve their own device claim.
-- migrate_guest_data still requires a claim. Non-admins cannot approve.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112130000_guest_claim_admin.sql

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
  v_found boolean := false;
  v_claimed boolean := false;
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

  SELECT EXISTS (
    SELECT 1 FROM public.legacy_guest_migration_claims
    WHERE guest_id = p_guest_id AND user_id = auth.uid()
  ) INTO v_claimed;

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
        v_found := true;
        v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','found','count', v_count));
      ELSE
        v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','empty','count', 0));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object(v_tbl, jsonb_build_object('status','failed','count',0,'error', SQLERRM));
    END;
  END LOOP;

  IF NOT v_claimed THEN
    IF v_found THEN
      RETURN jsonb_build_object('verification_required', true);
    END IF;
    RETURN v_out;
  END IF;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_legacy_guest_claim(p_guest_id text, p_reference text DEFAULT 'admin_self_device')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_ref text := left(btrim(COALESCE(p_reference, 'admin_self_device')), 500);
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF NOT public.is_legacy_guest_id(p_guest_id) THEN
    RAISE EXCEPTION 'invalid_guest_id';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = p_guest_id) THEN
    RAISE EXCEPTION 'guest_id_is_auth_user';
  END IF;
  IF v_ref IS NULL OR length(v_ref) = 0 THEN
    v_ref := 'admin_self_device';
  END IF;

  SELECT user_id INTO v_existing
  FROM public.legacy_guest_migration_claims
  WHERE guest_id = p_guest_id;

  IF v_existing IS NOT NULL AND v_existing <> auth.uid() THEN
    RAISE EXCEPTION 'guest_id_claimed_by_other_account';
  END IF;

  INSERT INTO public.legacy_guest_migration_claims (guest_id, user_id, verification_reference)
  VALUES (p_guest_id, auth.uid(), v_ref)
  ON CONFLICT (guest_id) DO UPDATE
    SET verification_reference = EXCLUDED.verification_reference,
        verified_at = now()
    WHERE public.legacy_guest_migration_claims.user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'guest_id', p_guest_id,
    'user_id', auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_legacy_guest_claim(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_legacy_guest_claim(text, text) TO authenticated;
