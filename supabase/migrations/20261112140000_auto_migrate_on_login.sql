-- Product: login on this browser attaches leftover guest data. No support claim.
-- Users must not verify or tap admin tools. migrate_guest_data still requires a
-- signed-in session and a real guest id (user_*), not another auth UUID.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112140000_auto_migrate_on_login.sql

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

  PERFORM pg_advisory_xact_lock(hashtextextended('migrate-guest:' || p_guest_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('migrate-account:' || v_auth, 0));
  PERFORM 1 FROM public.verse_notes WHERE user_id IN (p_guest_id, v_auth) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.user_reading_plans WHERE user_id IN (p_guest_id, v_auth) ORDER BY id FOR UPDATE;

  IF to_regclass('public.study_collections') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.study_collections WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.study_collections
        WHERE user_id = v_auth AND name IS NOT DISTINCT FROM v_guest.name
        LIMIT 1;
      IF FOUND THEN
        v_study_map := v_study_map || jsonb_build_object(v_guest.id::text, v_dest.id::text);
        PERFORM public._archive_guest_conflict(p_guest_id, 'study_collections', to_jsonb(v_guest));
        UPDATE public.verse_notes SET study_id = v_dest.id
          WHERE user_id = p_guest_id AND study_id = v_guest.id;
        DELETE FROM public.study_collections WHERE id = v_guest.id;
      ELSE
        UPDATE public.study_collections SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:study_collections'; END IF;
        v_study_map := v_study_map || jsonb_build_object(v_guest.id::text, v_guest.id::text);
      END IF;
    END LOOP;
  END IF;

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
        PERFORM public._archive_guest_conflict(p_guest_id, 'user_labels', to_jsonb(v_guest));
        DELETE FROM public.user_labels WHERE id = v_guest.id;
      ELSE
        UPDATE public.user_labels SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:user_labels'; END IF;
        v_label_map := v_label_map || jsonb_build_object(v_guest.id::text, v_guest.id::text);
      END IF;
    END LOOP;
  END IF;

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
        PERFORM public._archive_guest_conflict(p_guest_id, 'verse_notes', to_jsonb(v_guest));
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

  IF to_regclass('public.verse_highlights') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.verse_highlights WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.verse_highlights
        WHERE user_id = v_auth
          AND book_id = v_guest.book_id
          AND chapter = v_guest.chapter
          AND verse = v_guest.verse
          AND version = v_guest.version;
      IF FOUND THEN
        PERFORM public._archive_guest_conflict(p_guest_id, 'verse_highlights', to_jsonb(v_guest));
        DELETE FROM public.verse_highlights WHERE id = v_guest.id;
      ELSE
        UPDATE public.verse_highlights SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:verse_highlights'; END IF;
      END IF;
    END LOOP;
  END IF;

  IF to_regclass('public.highlight_categories') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.highlight_categories WHERE user_id = p_guest_id LOOP
      SELECT * INTO v_dest FROM public.highlight_categories
        WHERE user_id = v_auth AND color IS NOT DISTINCT FROM v_guest.color
        LIMIT 1;
      IF FOUND THEN
        PERFORM public._archive_guest_conflict(p_guest_id, 'highlight_categories', to_jsonb(v_guest));
        DELETE FROM public.highlight_categories WHERE id = v_guest.id;
      ELSE
        UPDATE public.highlight_categories SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:highlight_categories'; END IF;
      END IF;
    END LOOP;
  END IF;

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
        PERFORM public._archive_guest_conflict(p_guest_id, 'word_studies', to_jsonb(v_guest));
        DELETE FROM public.word_studies WHERE id = v_guest.id;
      ELSE
        UPDATE public.word_studies SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:word_studies'; END IF;
      END IF;
    END LOOP;
  END IF;

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
        PERFORM public._archive_guest_conflict(p_guest_id, 'user_reading_plans', to_jsonb(v_guest));
        DELETE FROM public.user_reading_plans WHERE id = v_guest.id;
      ELSE
        UPDATE public.user_reading_plans SET user_id = v_auth WHERE id = v_guest.id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:user_reading_plans'; END IF;
      END IF;
    END LOOP;
  END IF;

  IF to_regclass('public.user_plan_profiles') IS NOT NULL THEN
    FOR v_guest IN SELECT * FROM public.user_plan_profiles WHERE user_id = p_guest_id LOOP
      IF EXISTS (SELECT 1 FROM public.user_plan_profiles WHERE user_id = v_auth) THEN
        UPDATE public.user_plan_profiles d
          SET profile = COALESCE(d.profile, '{}'::jsonb) || COALESCE(v_guest.profile, '{}'::jsonb),
              updated_at = now()
          WHERE d.user_id = v_auth;
        PERFORM public._archive_guest_conflict(p_guest_id, 'user_plan_profiles', to_jsonb(v_guest));
        DELETE FROM public.user_plan_profiles WHERE user_id = p_guest_id;
      ELSE
        UPDATE public.user_plan_profiles SET user_id = v_auth WHERE user_id = p_guest_id;
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        IF v_moved = 0 THEN RAISE EXCEPTION 'transfer_failed:user_plan_profiles'; END IF;
      END IF;
    END LOOP;
  END IF;

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
      FOR v_guest IN SELECT * FROM public.user_settings WHERE user_id = p_guest_id LOOP
        PERFORM public._archive_guest_conflict(p_guest_id, 'user_settings', to_jsonb(v_guest));
      END LOOP;
      DELETE FROM public.user_settings WHERE user_id = p_guest_id;
    ELSE
      UPDATE public.user_settings SET user_id = v_auth WHERE user_id = p_guest_id;
    END IF;
  END IF;

  PERFORM public._assert_guest_empty(p_guest_id);

  UPDATE public.legacy_guest_migration_claims SET migrated_at = now()
    WHERE guest_id = p_guest_id AND user_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'auth_user_id', v_auth, 'guest_id', p_guest_id);
END;
$$;
