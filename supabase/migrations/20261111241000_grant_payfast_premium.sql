-- Auto-subscribe: grant premium from ITN even if the payment_orders row is missing.
-- Log ITN outcomes for support (no card numbers / no signatures).

CREATE TABLE IF NOT EXISTS public.payfast_itn_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  payment_status text,
  signature_ok boolean,
  order_id text,
  user_id text,
  pf_payment_id text,
  amount_cents integer,
  result text,
  error text
);

ALTER TABLE public.payfast_itn_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payfast_itn_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payfast_itn_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payfast_itn_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.grant_payfast_premium(
  p_user_id text,
  p_order_id uuid,
  p_pf_payment_id text,
  p_amount_cents int,
  p_item_name text,
  p_amount_gross numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_text text := trim(coalesce(p_user_id, ''));
  oid uuid := p_order_id;
  pfid text := nullif(trim(coalesce(p_pf_payment_id, '')), '');
  ord public.payment_orders%ROWTYPE;
  new_expiry timestamptz;
  cur_expiry timestamptz;
  updated int;
BEGIN
  PERFORM set_config('app.allow_subscription_update', 'on', true);

  IF uid_text = '' THEN
    RAISE EXCEPTION 'missing user';
  END IF;
  IF pfid IS NULL THEN
    pfid := 'itn-' || coalesce(oid::text, uid_text) || '-' || to_char(now(), 'YYYYMMDDHH24MISS');
  END IF;

  IF oid IS NOT NULL THEN
    SELECT * INTO ord FROM public.payment_orders WHERE id = oid FOR UPDATE;
  END IF;

  IF ord.id IS NULL THEN
    SELECT * INTO ord
      FROM public.payment_orders
      WHERE user_id::text = uid_text
        AND status = 'pending'
        AND (p_amount_cents IS NULL OR amount_cents = p_amount_cents)
        AND created_at > now() - interval '6 hours'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE;
  END IF;

  IF ord.id IS NOT NULL AND ord.user_id::text IS DISTINCT FROM uid_text THEN
    RAISE EXCEPTION 'user mismatch';
  END IF;

  SELECT subscription_expiry INTO cur_expiry
    FROM public.user_profiles
    WHERE user_id::text = uid_text;

  IF cur_expiry IS NULL OR cur_expiry < now() THEN
    new_expiry := now() + interval '30 days';
  ELSE
    new_expiry := cur_expiry + interval '30 days';
  END IF;

  UPDATE public.user_profiles
  SET
    subscription_tier = 'premium',
    subscription_override = 'premium',
    subscription_expiry = new_expiry,
    last_renewal_month = to_char(now(), 'YYYY-MM')
  WHERE user_id::text = uid_text;

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 1 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  INSERT INTO public.payment_history (
    user_id, status, amount_gross, pf_payment_id, payment_status, item_name, provider, order_id
  )
  SELECT
    uid_text::uuid,
    'success',
    coalesce(p_amount_gross, (coalesce(p_amount_cents, ord.amount_cents, 500)::numeric / 100.0)),
    pfid,
    'COMPLETE',
    coalesce(nullif(p_item_name, ''), ord.item_name, 'Omni Bible Subscription'),
    'payfast',
    ord.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_history WHERE pf_payment_id = pfid
  );

  IF ord.id IS NOT NULL AND ord.status IS DISTINCT FROM 'fulfilled' THEN
    UPDATE public.payment_orders
    SET status = 'fulfilled',
        pf_payment_id = pfid,
        fulfilled_at = now()
    WHERE id = ord.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'expiry', new_expiry,
    'order_id', ord.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_payfast_premium(text, uuid, text, int, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_payfast_premium(text, uuid, text, int, text, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_payfast_premium(text, uuid, text, int, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
