-- Reliability follow-up: guest migrate RPC, plan day bounds, note labels txn,
-- AI reserve, deletion leases, admin aggregate stats.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112090000_reliability_followup.sql

-- ---------------------------------------------------------------------------
-- Account deletion lease columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz;

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_status_check;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'cancelled'));

-- ---------------------------------------------------------------------------
-- Helpers: guest id must not be an auth user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_legacy_guest_id(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_id IS NOT NULL
     AND p_id ~ '^user_[A-Za-z0-9]+$'
     AND p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

CREATE OR REPLACE FUNCTION public._merge_text(p_dest text, p_guest text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF NULLIF(btrim(COALESCE(p_guest, '')), '') IS NULL THEN
    RETURN COALESCE(p_dest, '');
  END IF;
  IF NULLIF(btrim(COALESCE(p_dest, '')), '') IS NULL THEN
    RETURN p_guest;
  END IF;
  IF p_dest = p_guest OR position(p_guest in p_dest) > 0 THEN
    RETURN p_dest;
  END IF;
  RETURN p_dest || E'\n\n--- From guest device ---\n' || p_guest;
END;
$$;

-- ---------------------------------------------------------------------------
-- Inspect guest rows (SECURITY DEFINER so owner RLS does not hide them)
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.inspect_guest_migration(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_guest_migration(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Migrate guest data in one transaction (all-or-nothing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_guest_data(p_guest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth text := auth.uid()::text;
  v_moved int;
  v_guest record;
  v_dest record;
  v_new_id uuid;
  v_label_map jsonb := '{}'::jsonb;
  v_study_map jsonb := '{}'::jsonb;
  v_days int[];
  v_duration int;
  v_notes jsonb;
  v_key text;
  v_gval text;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.is_legacy_guest_id(p_guest_id) THEN
    RAISE EXCEPTION 'invalid_guest_id';
  END IF;
  IF p_guest_id = v_auth THEN
    RAISE EXCEPTION 'invalid_guest_id';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = p_guest_id) THEN
    RAISE EXCEPTION 'guest_id_is_auth_user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('migrate:' || v_auth || ':' || p_guest_id));

  -- study collections (remap ids for notes)
  IF to_regclass('public.study_collections') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.study_collections WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.study_collections
        WHERE user_id = v_auth AND name IS NOT DISTINCT FROM v_guest.name
        LIMIT 1;
      IF FOUND THEN
        v_study_map := v_study_map || jsonb_build_object(v_guest.id::text, v_dest.id::text);
        DELETE FROM public.study_collections WHERE id = v_guest.id;
      ELSE
        UPDATE public.study_collections SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:study_collections'; END IF;
        v_study_map := v_study_map || jsonb_build_object(v_guest.id::text, v_guest.id::text);
      END IF;
    END LOOP;
  END IF;

  -- labels
  IF to_regclass('public.user_labels') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.user_labels WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.user_labels
        WHERE user_id = v_auth AND name IS NOT DISTINCT FROM v_guest.name
        LIMIT 1;
      IF FOUND THEN
        v_label_map := v_label_map || jsonb_build_object(v_guest.id::text, v_dest.id::text);
        IF to_regclass('public.note_labels') IS NOT NULL THEN
          UPDATE public.note_labels nl
            SET label_id = v_dest.id
            WHERE nl.label_id = v_guest.id
              AND NOT EXISTS (
                SELECT 1 FROM public.note_labels x
                WHERE x.note_id = nl.note_id AND x.label_id = v_dest.id
              );
        END IF;
        DELETE FROM public.note_labels WHERE label_id = v_guest.id;
        DELETE FROM public.user_labels WHERE id = v_guest.id;
      ELSE
        UPDATE public.user_labels SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:user_labels'; END IF;
        v_label_map := v_label_map || jsonb_build_object(v_guest.id::text, v_guest.id::text);
      END IF;
    END LOOP;
  END IF;

  -- notes
  IF to_regclass('public.verse_notes') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.verse_notes WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.verse_notes
        WHERE user_id = v_auth
          AND book_id = v_guest.book_id
          AND chapter = v_guest.chapter
          AND verse = v_guest.verse
          AND version = v_guest.version;
      IF FOUND THEN
        UPDATE public.verse_notes
          SET note_text = public._merge_text(v_dest.note_text, v_guest.note_text),
              study_id = COALESCE(v_dest.study_id, (
                CASE WHEN v_guest.study_id IS NULL THEN NULL
                     ELSE COALESCE((v_study_map ->> v_guest.study_id::text)::uuid, v_guest.study_id)
                END
              )),
              updated_at = now()
          WHERE id = v_dest.id;
        IF to_regclass('public.note_labels') IS NOT NULL THEN
          UPDATE public.note_labels nl
            SET note_id = v_dest.id,
                label_id = COALESCE((v_label_map ->> nl.label_id::text)::uuid, nl.label_id)
            WHERE nl.note_id = v_guest.id
              AND NOT EXISTS (
                SELECT 1 FROM public.note_labels x
                WHERE x.note_id = v_dest.id
                  AND x.label_id = COALESCE((v_label_map ->> nl.label_id::text)::uuid, nl.label_id)
              );
          DELETE FROM public.note_labels WHERE note_id = v_guest.id;
        END IF;
        DELETE FROM public.verse_notes WHERE id = v_guest.id;
      ELSE
        UPDATE public.verse_notes
          SET user_id = v_auth,
              study_id = CASE WHEN v_guest.study_id IS NULL THEN NULL
                              ELSE COALESCE((v_study_map ->> v_guest.study_id::text)::uuid, v_guest.study_id)
                         END
          WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:verse_notes'; END IF;
      END IF;
    END LOOP;
  END IF;

  -- highlights: dest keeps colour if same verse; guest dropped only after dest exists
  IF to_regclass('public.verse_highlights') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.verse_highlights WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.verse_highlights
        WHERE user_id = v_auth
          AND book_id = v_guest.book_id
          AND chapter = v_guest.chapter
          AND verse = v_guest.verse
          AND version = v_guest.version;
      IF FOUND THEN
        DELETE FROM public.verse_highlights WHERE id = v_guest.id;
      ELSE
        UPDATE public.verse_highlights SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:verse_highlights'; END IF;
      END IF;
    END LOOP;
  END IF;

  -- highlight_categories
  IF to_regclass('public.highlight_categories') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.highlight_categories WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.highlight_categories
        WHERE user_id = v_auth AND color IS NOT DISTINCT FROM v_guest.color
        LIMIT 1;
      IF FOUND THEN
        DELETE FROM public.highlight_categories WHERE id = v_guest.id;
      ELSE
        UPDATE public.highlight_categories SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:highlight_categories'; END IF;
      END IF;
    END LOOP;
  END IF;

  -- word studies (unique per verse+word)
  IF to_regclass('public.word_studies') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.word_studies WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.word_studies
        WHERE user_id = v_auth
          AND book_id IS NOT DISTINCT FROM v_guest.book_id
          AND chapter IS NOT DISTINCT FROM v_guest.chapter
          AND verse IS NOT DISTINCT FROM v_guest.verse
          AND word IS NOT DISTINCT FROM v_guest.word
        LIMIT 1;
      IF FOUND THEN
        DELETE FROM public.word_studies WHERE id = v_guest.id;
      ELSE
        UPDATE public.word_studies SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:word_studies'; END IF;
      END IF;
    END LOOP;
  END IF;

  -- reading plans
  IF to_regclass('public.user_reading_plans') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.user_reading_plans WHERE user_id = p_guest_id LOOP
      v_dest := NULL;
      SELECT * INTO v_dest FROM public.user_reading_plans
        WHERE user_id = v_auth AND plan_id = v_guest.plan_id
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END
        LIMIT 1;
      SELECT duration_days INTO v_duration FROM public.reading_plans WHERE id = v_guest.plan_id;
      IF v_dest.id IS NOT NULL THEN
        v_days := ARRAY(
          SELECT DISTINCT d FROM unnest(
            COALESCE(v_dest.completed_days, '{}') || COALESCE(v_guest.completed_days, '{}')
          ) AS d
          WHERE d >= 1 AND (v_duration IS NULL OR d <= v_duration)
          ORDER BY 1
        );
        v_notes := COALESCE(v_dest.day_notes, '{}'::jsonb);
        FOR v_key, v_gval IN
          SELECT key, value #>> '{}' FROM jsonb_each(COALESCE(v_guest.day_notes, '{}'::jsonb))
        LOOP
          v_notes := jsonb_set(
            v_notes,
            ARRAY[v_key],
            to_jsonb(public._merge_text(v_notes ->> v_key, v_gval)),
            true
          );
        END LOOP;
        UPDATE public.user_reading_plans
          SET completed_days = v_days,
              day_notes = v_notes,
              current_day = GREATEST(COALESCE(v_dest.current_day, 1), COALESCE(v_guest.current_day, 1)),
              last_activity_at = now(),
              status = CASE
                WHEN v_dest.status = 'completed' OR v_guest.status = 'completed' THEN 'completed'
                WHEN v_dest.status = 'active' OR v_guest.status = 'active' THEN 'active'
                ELSE v_dest.status
              END
          WHERE id = v_dest.id;
        DELETE FROM public.user_reading_plans WHERE id = v_guest.id;
      ELSE
        UPDATE public.user_reading_plans SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:user_reading_plans'; END IF;
      END IF;
    END LOOP;
  END IF;

  -- plan profiles (PK user_id)
  IF to_regclass('public.user_plan_profiles') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.user_plan_profiles WHERE user_id = p_guest_id LOOP
      IF EXISTS (SELECT 1 FROM public.user_plan_profiles WHERE user_id = v_auth) THEN
        UPDATE public.user_plan_profiles d
          SET profile = COALESCE(d.profile, '{}'::jsonb) || COALESCE(v_guest.profile, '{}'::jsonb),
              updated_at = now()
          WHERE d.user_id = v_auth;
        DELETE FROM public.user_plan_profiles WHERE user_id = p_guest_id;
      ELSE
        UPDATE public.user_plan_profiles SET user_id = v_auth WHERE user_id = p_guest_id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:user_plan_profiles'; END IF;
      END IF;
    END LOOP;
  END IF;

  -- bulk reassign remaining tables (no uniqueness beyond id)
  PERFORM public._reassign_guest_table('inductive_studies', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('search_logs', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('ai_questions', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('devotional_history', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('sermons', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('user_plan_events', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('user_activity_logs', p_guest_id, v_auth);
  PERFORM public._reassign_guest_table('bible_reading_logs', p_guest_id, v_auth);

  IF to_regclass('public.user_settings') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = v_auth) THEN
      DELETE FROM public.user_settings WHERE user_id = p_guest_id;
    ELSE
      UPDATE public.user_settings SET user_id = v_auth WHERE user_id = p_guest_id;
    END IF;
  END IF;

  -- verify no guest rows remain on migrate tables
  PERFORM public._assert_guest_empty(p_guest_id);

  RETURN jsonb_build_object('success', true, 'auth_user_id', v_auth, 'guest_id', p_guest_id);
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
  v_left int;
BEGIN
  IF NOT (p_table = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'table_not_allowed';
  END IF;
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;
  EXECUTE format('UPDATE public.%I SET user_id = $1 WHERE user_id = $2', p_table)
    USING p_to, p_from;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', p_table)
    INTO v_left USING p_from;
  IF v_left > 0 THEN
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
  v_left int;
  v_tables text[] := ARRAY[
    'verse_highlights','verse_notes','study_collections','highlight_categories','user_labels',
    'word_studies','inductive_studies','search_logs','ai_questions','devotional_history',
    'sermons','user_settings','user_reading_plans','user_plan_events','user_plan_profiles'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', v_tbl)
      INTO v_left USING p_guest_id;
    IF v_left > 0 THEN
      RAISE EXCEPTION 'remaining_guest_rows:%', v_tbl;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_guest_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrate_guest_data(text) TO authenticated;
REVOKE ALL ON FUNCTION public._reassign_guest_table(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_guest_empty(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._merge_text(text, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Reading plan day bounds + completed-plan retry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_plan_day(p_enrollment_id uuid, p_day integer)
RETURNS public.user_reading_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_reading_plans;
  v_duration integer;
  v_new_completed integer[];
  v_is_finished boolean;
  v_next_day integer;
  v_already boolean;
BEGIN
  SELECT urp.*
  INTO v_row
  FROM public.user_reading_plans urp
  WHERE urp.id = p_enrollment_id
    AND urp.user_id = auth.uid()::text
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'enrollment_not_found';
  END IF;

  SELECT rp.duration_days INTO v_duration
  FROM public.reading_plans rp WHERE rp.id = v_row.plan_id;

  IF p_day IS NULL OR p_day < 1 OR v_duration IS NULL OR p_day > v_duration THEN
    RAISE EXCEPTION 'invalid_day';
  END IF;

  IF v_row.status IS DISTINCT FROM 'active' AND v_row.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'plan_not_active';
  END IF;

  v_already := p_day = ANY (COALESCE(v_row.completed_days, '{}'));

  v_new_completed := ARRAY(
    SELECT DISTINCT d FROM unnest(COALESCE(v_row.completed_days, '{}') || ARRAY[p_day]) AS d
    WHERE d >= 1 AND d <= v_duration
    ORDER BY 1
  );

  v_is_finished := COALESCE(array_length(v_new_completed, 1), 0) >= v_duration;
  v_next_day := LEAST(p_day + 1, v_duration);

  UPDATE public.user_reading_plans
  SET
    completed_days = v_new_completed,
    current_day = CASE WHEN v_is_finished THEN v_duration ELSE GREATEST(COALESCE(v_row.current_day, 1), v_next_day) END,
    last_activity_at = now(),
    status = CASE WHEN v_is_finished THEN 'completed' ELSE 'active' END,
    completed_at = CASE
      WHEN v_is_finished THEN COALESCE(v_row.completed_at, now())
      ELSE NULL
    END
  WHERE id = p_enrollment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.patch_plan_day_note(
  p_enrollment_id uuid,
  p_day integer,
  p_note_text text
)
RETURNS public.user_reading_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_reading_plans;
  v_notes jsonb;
  v_key text;
  v_duration integer;
BEGIN
  SELECT urp.*
  INTO v_row
  FROM public.user_reading_plans urp
  WHERE urp.id = p_enrollment_id
    AND urp.user_id = auth.uid()::text
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'enrollment_not_found';
  END IF;

  SELECT rp.duration_days INTO v_duration
  FROM public.reading_plans rp WHERE rp.id = v_row.plan_id;

  IF p_day IS NULL OR p_day < 1 OR v_duration IS NULL OR p_day > v_duration THEN
    RAISE EXCEPTION 'invalid_day';
  END IF;

  v_key := p_day::text;
  v_notes := COALESCE(v_row.day_notes, '{}'::jsonb);

  IF NULLIF(trim(p_note_text), '') IS NULL THEN
    v_notes := v_notes - v_key;
  ELSE
    v_notes := jsonb_set(v_notes, ARRAY[v_key], to_jsonb(trim(p_note_text)), true);
  END IF;

  UPDATE public.user_reading_plans
  SET day_notes = v_notes, last_activity_at = now()
  WHERE id = p_enrollment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Atomic note + labels
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_verse_note_with_labels(
  p_book_id text,
  p_chapter int,
  p_verse int,
  p_version text,
  p_note_text text,
  p_study_id uuid,
  p_label_ids uuid[]
)
RETURNS public.verse_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth text := auth.uid()::text;
  v_note public.verse_notes;
  v_ids uuid[];
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NULLIF(trim(p_note_text), '') IS NULL THEN
    RAISE EXCEPTION 'empty_note';
  END IF;

  INSERT INTO public.verse_notes (
    user_id, book_id, chapter, verse, version, note_text, study_id, updated_at
  ) VALUES (
    v_auth, p_book_id, p_chapter, p_verse, p_version, p_note_text, p_study_id, now()
  )
  ON CONFLICT (user_id, book_id, chapter, verse, version)
  DO UPDATE SET
    note_text = EXCLUDED.note_text,
    study_id = EXCLUDED.study_id,
    updated_at = now()
  RETURNING * INTO v_note;

  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_label_ids, '{}')) AS x
    WHERE x IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_labels ul
        WHERE ul.id = x AND ul.user_id = v_auth
      )
  ) INTO v_ids;

  DELETE FROM public.note_labels WHERE note_id = v_note.id;

  IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
    INSERT INTO public.note_labels (note_id, label_id)
    SELECT v_note.id, x FROM unnest(v_ids) AS x;
  END IF;

  RETURN v_note;
END;
$$;

REVOKE ALL ON FUNCTION public.save_verse_note_with_labels(text, int, int, text, text, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_verse_note_with_labels(text, int, int, text, text, uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reserve AI usage atomically (check + increment)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_ai_usage(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth text := auth.uid()::text;
  v_count integer;
  v_limit integer := COALESCE(p_limit, 50);
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.user_profiles
  SET
    ai_usage_count = COALESCE(ai_usage_count, 0) + 1,
    last_seen = now()
  WHERE user_id = v_auth
    AND COALESCE(ai_usage_count, 0) < v_limit
  RETURNING ai_usage_count INTO v_count;

  IF v_count IS NOT NULL THEN
    RETURN v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = v_auth) THEN
    RAISE EXCEPTION 'AI_LIMIT_EXCEEDED';
  END IF;

  RAISE EXCEPTION 'profile_not_found';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(integer) TO authenticated;

-- keep increment_ai_usage as wrapper
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::text IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN public.reserve_ai_usage(999999);
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim deletion jobs (service role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_account_deletion_jobs(p_limit integer DEFAULT 5)
RETURNS SETOF public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM public.account_deletion_requests
    WHERE (
      (status = 'pending' AND execute_after <= now())
      OR (status = 'processing' AND (lease_until IS NULL OR lease_until < now()))
    )
    ORDER BY execute_after
    LIMIT GREATEST(COALESCE(p_limit, 5), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.account_deletion_requests r
  SET status = 'processing',
      claimed_at = now(),
      lease_until = now() + interval '15 minutes'
  FROM due
  WHERE r.id = due.id
  RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_account_deletion_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_jobs(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Admin aggregate stats (no 1000-row cap)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trivia_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT public.is_admin_jwt() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'totalQuestions', (SELECT count(*) FROM public.user_trivia_history),
    'totalCorrect', (SELECT count(*) FROM public.user_trivia_history WHERE is_correct IS TRUE),
    'uniqueUsers', (SELECT count(DISTINCT user_id) FROM public.user_trivia_history),
    'activityByDate', COALESCE((
      SELECT jsonb_object_agg(d, c)
      FROM (
        SELECT (answered_at::date)::text AS d, count(*)::int AS c
        FROM public.user_trivia_history
        WHERE answered_at >= (now() - interval '30 days')
        GROUP BY 1
      ) s
    ), '{}'::jsonb),
    'dbQuestionsCount', (SELECT count(*) FROM public.trivia_questions)
  ) INTO v_out;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_global_activity_counts_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT public.is_admin_jwt() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'bible', (SELECT count(*) FROM public.bible_reading_logs),
    'search', (SELECT count(*) FROM public.search_logs),
    'sermon_creation', (SELECT count(*) FROM public.sermons),
    'trivia_play', (SELECT count(*) FROM public.user_trivia_history),
    'trivia_correct', (SELECT count(*) FROM public.user_trivia_history WHERE is_correct IS TRUE),
    'inductive_hint_1', (SELECT count(*) FROM public.ai_questions WHERE question LIKE 'Inductive Hint Step 1%'),
    'inductive_hint_2', (SELECT count(*) FROM public.ai_questions WHERE question LIKE 'Inductive Hint Step 2%'),
    'inductive_hint_3', (SELECT count(*) FROM public.ai_questions WHERE question LIKE 'Inductive Hint Step 3%'),
    'word_study_ai', (SELECT count(*) FROM public.ai_questions WHERE question LIKE 'Word Study:%'),
    'semantic_search', (SELECT count(*) FROM public.ai_questions WHERE question LIKE 'Semantic Search:%'),
    'ai', (SELECT count(*) FROM public.ai_questions WHERE coalesce(question, '') NOT LIKE 'Inductive Hint Step%' AND coalesce(question, '') NOT LIKE 'Word Study:%' AND coalesce(question, '') NOT LIKE 'Semantic Search:%')
  ) INTO v_out;

  IF to_regclass('public.user_activity_logs') IS NOT NULL THEN
    v_out := v_out || COALESCE((
      SELECT jsonb_object_agg(activity_type, cnt)
      FROM (
        SELECT activity_type, count(*)::int AS cnt
        FROM public.user_activity_logs
        GROUP BY activity_type
      ) a
    ), '{}'::jsonb);
  END IF;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trivia_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_global_activity_counts_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trivia_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_activity_counts_v2() TO authenticated;
