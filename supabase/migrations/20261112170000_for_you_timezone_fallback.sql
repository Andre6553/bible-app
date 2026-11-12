-- For You: unknown browser timezones must not fail the whole slot.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112170000_for_you_timezone_fallback.sql

CREATE OR REPLACE FUNCTION public.for_you_claim_content(
  p_timezone text,p_language text,p_slot text,p_fingerprint text,p_force boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_row public.for_you_slots; v_content public.for_you_content; v_day date; v_token uuid;
  v_hours integer; v_super boolean:=false; v_profile public.user_profiles; v_explicit jsonb:='[]';
  v_tz text := COALESCE(NULLIF(btrim(p_timezone), ''), 'Africa/Johannesburg');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=v_tz) THEN
    v_tz := 'Africa/Johannesburg';
  END IF;
  IF p_language IS NULL OR p_language NOT IN ('en','af')
    OR p_slot IS NULL OR p_slot NOT IN ('devotional','article_1','article_2')
    OR p_fingerprint IS NULL OR length(p_fingerprint)>200 THEN RAISE EXCEPTION 'invalid_slot'; END IF;
  v_day:=(now() AT TIME ZONE v_tz)::date;
  INSERT INTO public.for_you_slots(user_id,local_day,language,slot)
    VALUES(auth.uid(),v_day,p_language,p_slot) ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM public.for_you_slots
    WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot FOR UPDATE;
  SELECT * INTO v_content FROM public.for_you_content WHERE id=v_row.content_id;
  IF NOT p_force AND v_row.content_id IS NOT NULL AND v_row.fingerprint=p_fingerprint THEN
    RETURN jsonb_build_object('status','cached','content',v_content,'day',v_day);
  END IF;
  IF v_row.lease_until>now() THEN RETURN jsonb_build_object('status','busy','content',v_content,'day',v_day); END IF;
  SELECT * INTO v_profile FROM public.user_profiles WHERE user_id=auth.uid()::text;
  BEGIN
    SELECT value::jsonb INTO v_explicit FROM public.app_settings WHERE key='super_users';
  EXCEPTION WHEN invalid_text_representation THEN v_explicit:='[]'; END;
  v_super:=COALESCE(v_explicit ? auth.uid()::text,false) OR COALESCE(v_explicit ? v_profile.email,false)
    OR COALESCE(v_profile.subscription_override IN ('admin','tester'),false)
    OR COALESCE(v_profile.subscription_tier='admin',false)
    OR COALESCE((v_profile.subscription_tier='premium' OR v_profile.subscription_override='premium')
        AND v_profile.subscription_expiry>now(),false)
    OR (v_profile.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.app_settings WHERE key='free_mode' AND value='true'));
  v_hours:=CASE WHEN EXISTS(SELECT 1 FROM public.app_settings WHERE key='blog_rate_limit_enabled' AND value='true') THEN 24 ELSE 1 END;
  IF p_force AND NOT v_super AND v_row.last_generated_at+make_interval(hours=>v_hours)>now() THEN
    RETURN jsonb_build_object('status','cooldown','content',v_content,'available_at',v_row.last_generated_at+make_interval(hours=>v_hours),'day',v_day);
  END IF;
  v_token:=gen_random_uuid();
  UPDATE public.for_you_slots SET lease_token=v_token,lease_until=now()+interval '3 minutes',
    generation=generation+1 WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot;
  RETURN jsonb_build_object('status','claimed','token',v_token,'day',v_day,'generation',v_row.generation+1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.for_you_claim_content(text,text,text,text,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
