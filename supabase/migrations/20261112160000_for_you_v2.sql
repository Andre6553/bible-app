-- For You only. Run as ONE exec_sql call after review. No shared settings/auth/payment changes.
CREATE TABLE IF NOT EXISTS public.for_you_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{"topics":{}}',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.for_you_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_day date NOT NULL,
  language text NOT NULL CHECK (language IN ('en','af')),
  slot text NOT NULL CHECK (slot IN ('devotional','article_1','article_2')),
  generation integer NOT NULL,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,local_day,language,slot,generation)
);
CREATE INDEX IF NOT EXISTS for_you_history ON public.for_you_content(user_id,generated_at DESC);
CREATE TABLE IF NOT EXISTS public.for_you_slots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_day date NOT NULL, language text NOT NULL CHECK (language IN ('en','af')),
  slot text NOT NULL CHECK (slot IN ('devotional','article_1','article_2')),
  generation integer NOT NULL DEFAULT 0,
  content_id uuid REFERENCES public.for_you_content(id) ON DELETE SET NULL,
  fingerprint text NOT NULL DEFAULT '',
  lease_token uuid, lease_until timestamptz, last_generated_at timestamptz,
  PRIMARY KEY(user_id,local_day,language,slot)
);
CREATE TABLE IF NOT EXISTS public.for_you_feedback (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.for_you_content(id) ON DELETE CASCADE,
  saved boolean NOT NULL DEFAULT false, helpful boolean NOT NULL DEFAULT false,
  read boolean NOT NULL DEFAULT false, less_like boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,content_id)
);

ALTER TABLE public.for_you_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.for_you_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.for_you_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.for_you_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.for_you_preferences,public.for_you_content,public.for_you_slots,public.for_you_feedback FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.for_you_preferences,public.for_you_content,public.for_you_slots,public.for_you_feedback TO authenticated;
GRANT ALL ON public.for_you_preferences,public.for_you_content,public.for_you_slots,public.for_you_feedback TO service_role;
CREATE POLICY for_you_pref_read ON public.for_you_preferences FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY for_you_content_read ON public.for_you_content FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY for_you_slot_read ON public.for_you_slots FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY for_you_feedback_read ON public.for_you_feedback FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.for_you_get_preferences()
RETURNS public.for_you_preferences LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.for_you_preferences; v_legacy jsonb := '{}'; v_value text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  -- Import only the caller's legacy preferences, once, preserving the original record.
  IF NOT EXISTS(SELECT 1 FROM public.for_you_preferences WHERE user_id=auth.uid()) THEN
    SELECT value INTO v_value FROM public.app_settings WHERE key='keyword_prefs_'||auth.uid()::text;
    BEGIN
      IF v_value IS NOT NULL THEN v_legacy:=v_value::jsonb; END IF;
    EXCEPTION WHEN invalid_text_representation THEN v_legacy:='{}'; END;
    INSERT INTO public.for_you_preferences(user_id,preferences)
      VALUES(auth.uid(),jsonb_build_object('topics','{}'::jsonb,'legacy',v_legacy))
      ON CONFLICT(user_id) DO NOTHING;
  END IF;
  SELECT * INTO v_row FROM public.for_you_preferences WHERE user_id=auth.uid();
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.for_you_patch_preferences(p_version integer,p_topic text,p_state text)
RETURNS public.for_you_preferences LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.for_you_preferences;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_state IS NULL OR p_state NOT IN ('prefer','exclude','neutral') OR p_topic IS NULL
     OR p_topic !~ '^[a-z0-9_]{1,80}$' THEN RAISE EXCEPTION 'invalid_preference'; END IF;
  UPDATE public.for_you_preferences
    SET preferences=jsonb_set(preferences,ARRAY['topics',p_topic],to_jsonb(p_state),true),
        version=version+1,updated_at=now()
    WHERE user_id=auth.uid() AND version=p_version RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'preferences_changed_reload'; END IF;
  RETURN v_row;
END; $$;

-- One leased generator per account/day/language/slot; no transaction spans an AI request.
CREATE OR REPLACE FUNCTION public.for_you_claim_content(
  p_timezone text,p_language text,p_slot text,p_fingerprint text,p_force boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_row public.for_you_slots; v_content public.for_you_content; v_day date; v_token uuid;
  v_hours integer; v_super boolean:=false; v_profile public.user_profiles; v_explicit jsonb:='[]';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone)
    OR p_language IS NULL OR p_language NOT IN ('en','af')
    OR p_slot IS NULL OR p_slot NOT IN ('devotional','article_1','article_2')
    OR p_fingerprint IS NULL OR length(p_fingerprint)>200 THEN RAISE EXCEPTION 'invalid_slot'; END IF;
  v_day:=(now() AT TIME ZONE p_timezone)::date;
  INSERT INTO public.for_you_slots(user_id,local_day,language,slot)
    VALUES(auth.uid(),v_day,p_language,p_slot) ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM public.for_you_slots
    WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot FOR UPDATE;
  SELECT * INTO v_content FROM public.for_you_content WHERE id=v_row.content_id;
  IF NOT p_force AND v_row.content_id IS NOT NULL AND v_row.fingerprint=p_fingerprint THEN
    RETURN jsonb_build_object('status','cached','content',v_content);
  END IF;
  IF v_row.lease_until>now() THEN RETURN jsonb_build_object('status','busy','content',v_content); END IF;
  -- Preserve existing For You refresh policy: explicit super users and premium/free-mode accounts bypass.
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
    RETURN jsonb_build_object('status','cooldown','content',v_content,'available_at',v_row.last_generated_at+make_interval(hours=>v_hours));
  END IF;
  v_token:=gen_random_uuid();
  UPDATE public.for_you_slots SET lease_token=v_token,lease_until=now()+interval '3 minutes',
    generation=generation+1 WHERE user_id=auth.uid() AND local_day=v_day AND language=p_language AND slot=p_slot;
  RETURN jsonb_build_object('status','claimed','token',v_token,'day',v_day,'generation',v_row.generation+1);
END; $$;

CREATE OR REPLACE FUNCTION public.for_you_complete_content(p_token uuid,p_fingerprint text,p_payload jsonb)
RETURNS public.for_you_content LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_slot public.for_you_slots; v_content public.for_you_content;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR length(p_payload::text)>64000
    OR NULLIF(btrim(p_payload->>'title'),'') IS NULL OR jsonb_typeof(p_payload->'paragraphs') IS DISTINCT FROM 'array'
    OR p_fingerprint IS NULL OR length(p_fingerprint)>200 THEN RAISE EXCEPTION 'invalid_content'; END IF;
  SELECT * INTO v_slot FROM public.for_you_slots WHERE user_id=auth.uid() AND lease_token=p_token AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'generation_lease_lost'; END IF;
  INSERT INTO public.for_you_content(user_id,local_day,language,slot,generation,payload)
    VALUES(auth.uid(),v_slot.local_day,v_slot.language,v_slot.slot,v_slot.generation,p_payload)
    RETURNING * INTO v_content;
  UPDATE public.for_you_slots SET content_id=v_content.id,fingerprint=p_fingerprint,last_generated_at=now(),lease_token=NULL,lease_until=NULL
    WHERE user_id=auth.uid() AND lease_token=p_token;
  RETURN v_content;
END; $$;

CREATE OR REPLACE FUNCTION public.for_you_release_content(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.for_you_slots SET lease_token=NULL,lease_until=NULL WHERE user_id=auth.uid() AND lease_token=p_token;
$$;

CREATE OR REPLACE FUNCTION public.for_you_set_feedback(p_content_id uuid,p_field text,p_value boolean)
RETURNS public.for_you_feedback LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.for_you_feedback;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.for_you_content WHERE id=p_content_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'content_not_found'; END IF;
  IF p_field IS NULL OR p_field NOT IN ('saved','helpful','read','less_like') OR p_value IS NULL THEN RAISE EXCEPTION 'invalid_feedback'; END IF;
  INSERT INTO public.for_you_feedback(user_id,content_id) VALUES(auth.uid(),p_content_id) ON CONFLICT DO NOTHING;
  EXECUTE format('UPDATE public.for_you_feedback SET %I=$1,updated_at=now() WHERE user_id=$2 AND content_id=$3 RETURNING *',p_field)
    INTO v_row USING p_value,auth.uid(),p_content_id;
  RETURN v_row;
END; $$;

REVOKE ALL ON FUNCTION public.for_you_get_preferences() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.for_you_patch_preferences(integer,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.for_you_claim_content(text,text,text,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.for_you_complete_content(uuid,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.for_you_release_content(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.for_you_set_feedback(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.for_you_get_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.for_you_patch_preferences(integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.for_you_claim_content(text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.for_you_complete_content(uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.for_you_release_content(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.for_you_set_feedback(uuid,text,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
