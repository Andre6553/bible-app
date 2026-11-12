-- Reliability: reading-plan RPCs, atomic AI usage, account deletion queue
-- Apply: node scripts/run_sql.js supabase/migrations/20261112080000_reliability_rpcs.sql

-- ---------------------------------------------------------------------------
-- Reading plan: atomic day complete
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
BEGIN
  IF p_day IS NULL OR p_day < 1 THEN
    RAISE EXCEPTION 'invalid_day';
  END IF;

  SELECT urp.*
  INTO v_row
  FROM public.user_reading_plans urp
  WHERE urp.id = p_enrollment_id
    AND urp.user_id = auth.uid()::text
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'enrollment_not_found';
  END IF;

  IF v_row.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'plan_not_active';
  END IF;

  SELECT rp.duration_days
  INTO v_duration
  FROM public.reading_plans rp
  WHERE rp.id = v_row.plan_id;

  v_new_completed := ARRAY(
    SELECT DISTINCT unnest(COALESCE(v_row.completed_days, '{}') || ARRAY[p_day])
  );
  v_new_completed := ARRAY(SELECT unnest(v_new_completed) ORDER BY 1);

  v_is_finished := v_duration > 0 AND array_length(v_new_completed, 1) >= v_duration;
  v_next_day := LEAST(p_day + 1, COALESCE(v_duration, p_day) + 1);

  UPDATE public.user_reading_plans
  SET
    completed_days = v_new_completed,
    current_day = CASE WHEN v_is_finished THEN COALESCE(v_duration, v_row.current_day) ELSE GREATEST(COALESCE(v_row.current_day, 1), v_next_day) END,
    last_activity_at = now(),
    status = CASE WHEN v_is_finished THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN v_is_finished THEN now() ELSE NULL END
  WHERE id = p_enrollment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_plan_day(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_plan_day(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reading plan: patch single day note (jsonb merge)
-- ---------------------------------------------------------------------------
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
BEGIN
  IF p_day IS NULL OR p_day < 1 THEN
    RAISE EXCEPTION 'invalid_day';
  END IF;

  v_key := p_day::text;

  SELECT urp.*
  INTO v_row
  FROM public.user_reading_plans urp
  WHERE urp.id = p_enrollment_id
    AND urp.user_id = auth.uid()::text
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'enrollment_not_found';
  END IF;

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

REVOKE ALL ON FUNCTION public.patch_plan_day_note(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_plan_day_note(uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Atomic AI usage increment (limit enforcement stays in app for now)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::text IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.user_profiles
  SET
    ai_usage_count = COALESCE(ai_usage_count, 0) + 1,
    last_seen = now()
  WHERE user_id = p_user_id
  RETURNING ai_usage_count INTO v_count;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_ai_usage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion requests (7-day queue)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  email text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  execute_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  processed_at timestamptz,
  error_message text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_one_pending
  ON public.account_deletion_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_account_deletion_execute
  ON public.account_deletion_requests (execute_after)
  WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_deletion_select_own ON public.account_deletion_requests;
CREATE POLICY account_deletion_select_own
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS account_deletion_insert_own ON public.account_deletion_requests;
CREATE POLICY account_deletion_insert_own
  ON public.account_deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);
