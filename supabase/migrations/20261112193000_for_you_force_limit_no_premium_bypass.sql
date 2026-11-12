-- For You: only super_users + admin/tester bypass daily force cap (not premium or free_mode).
-- Apply: node scripts/run_sql.js supabase/migrations/20261112193000_for_you_force_limit_no_premium_bypass.sql

CREATE OR REPLACE FUNCTION public.for_you_claim_content(
  p_timezone text,p_language text,p_slot text,p_fingerprint text,p_force boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_row public.for_you_slots; v_content public.for_you_content; v_day date; v_token uuid;
  v_super boolean:=false; v_profile public.user_profiles; v_explicit jsonb:='[]';
  v_tz text := COALESCE(NULLIF(btrim(p_timezone), ''), 'Africa/Johannesburg');
  v_force_left integer;
  v_next timestamptz;
  v_uid text := auth.uid()::text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=v_tz) THEN
    v_tz := 'Africa/Johannesburg';
  END IF;
  IF p_language IS NULL OR p_language NOT IN ('en','af')
    OR p_slot IS NULL OR p_slot NOT IN ('devotional','article_1','article_2')
    OR p_fingerprint IS NULL OR length(p_fingerprint)>200 THEN RAISE EXCEPTION 'invalid_slot'; END IF;
  v_day:=(now() AT TIME ZONE v_tz)::date;
  v_next:=((v_day + 1)::timestamp AT TIME ZONE v_tz);
  INSERT INTO public.for_you_slots(user_id,local_day,language,slot)
    VALUES(auth.uid(),v_day,p_language,p_slot) ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM public.for_you_slots
    WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot FOR UPDATE;
  IF v_row.lease_until IS NOT NULL AND v_row.lease_until <= now() THEN
    UPDATE public.for_you_slots SET lease_token=NULL, lease_until=NULL
      WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot;
    v_row.lease_token := NULL;
    v_row.lease_until := NULL;
  END IF;
  SELECT * INTO v_content FROM public.for_you_content WHERE id=v_row.content_id;
  SELECT * INTO v_profile FROM public.user_profiles WHERE user_id=v_uid;
  BEGIN
    SELECT value::jsonb INTO v_explicit FROM public.app_settings WHERE key='super_users';
  EXCEPTION WHEN invalid_text_representation THEN v_explicit:='[]'; END;
  v_super:=COALESCE(v_explicit @> to_jsonb(v_uid), false)
    OR COALESCE(v_profile.email IS NOT NULL AND v_explicit @> to_jsonb(v_profile.email), false)
    OR COALESCE(v_profile.subscription_override IN ('admin','tester'),false)
    OR COALESCE(v_profile.subscription_tier='admin',false);
  v_force_left:=CASE WHEN v_super THEN 99 ELSE greatest(0, 1 - COALESCE(v_row.force_generations, 0)) END;
  IF NOT p_force AND v_row.content_id IS NOT NULL AND v_row.fingerprint=p_fingerprint THEN
    RETURN jsonb_build_object('status','cached','content',v_content,'day',v_day,'force_remaining',v_force_left);
  END IF;
  IF v_row.lease_until>now() AND NOT p_force THEN
    RETURN jsonb_build_object('status','busy','content',v_content,'day',v_day,'force_remaining',v_force_left);
  END IF;
  IF v_row.lease_until>now() AND p_force THEN
    UPDATE public.for_you_slots SET lease_token=NULL, lease_until=NULL
      WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot;
  END IF;
  IF p_force AND NOT v_super AND COALESCE(v_row.force_generations, 0) >= 1 THEN
    RETURN jsonb_build_object('status','cooldown','content',v_content,'available_at',v_next,'day',v_day,'force_remaining',0);
  END IF;
  v_token:=gen_random_uuid();
  UPDATE public.for_you_slots SET
    lease_token=v_token,
    lease_until=now()+interval '3 minutes',
    generation=generation+1,
    force_generations=CASE WHEN p_force AND NOT v_super THEN COALESCE(force_generations,0)+1 ELSE force_generations END
  WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot;
  SELECT force_generations, generation INTO v_row.force_generations, v_row.generation
    FROM public.for_you_slots
    WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot;
  v_force_left:=CASE WHEN v_super THEN 99 ELSE greatest(0, 1 - COALESCE(v_row.force_generations, 0)) END;
  RETURN jsonb_build_object('status','claimed','token',v_token,'day',v_day,'generation',v_row.generation,'force_remaining',v_force_left);
END;
$$;
GRANT EXECUTE ON FUNCTION public.for_you_claim_content(text,text,text,text,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
