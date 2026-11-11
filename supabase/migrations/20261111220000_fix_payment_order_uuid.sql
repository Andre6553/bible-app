-- Fix uuid vs text in payment RPCs (live payment_history.user_id may be uuid)

CREATE OR REPLACE FUNCTION public.create_payment_order()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uid_text text := auth.uid()::text;
  full_rands int;
  cents int;
  prior int;
  item text;
  oid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(NULLIF(trim(value), '')::int, 85)
    INTO full_rands
    FROM public.app_config
    WHERE key = 'subscription_price_zar';

  IF full_rands IS NULL OR full_rands < 10 THEN
    full_rands := 85;
  END IF;

  SELECT COUNT(*)::int INTO prior
    FROM public.payment_history
    WHERE user_id::text = uid_text AND status = 'success';

  IF prior > 0 THEN
    cents := full_rands * 100;
    item := 'Omni Bible Subscription';
  ELSE
    cents := GREATEST((full_rands / 2) * 100, 100);
    item := 'Omni Bible Subscription (50% Off)';
  END IF;

  INSERT INTO public.payment_orders (user_id, amount_cents, item_name)
  VALUES (uid_text, cents, item)
  RETURNING id INTO oid;

  RETURN jsonb_build_object(
    'order_id', oid,
    'amount', to_char(cents / 100.0, 'FM999999990.00'),
    'amount_cents', cents,
    'item_name', item
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_payfast_itn(
  p_order_id uuid,
  p_pf_payment_id text,
  p_amount_cents int,
  p_user_id text,
  p_item_name text,
  p_amount_gross numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.payment_orders%ROWTYPE;
  existing public.payment_history%ROWTYPE;
  new_expiry timestamptz;
  cur_expiry timestamptz;
  updated int;
BEGIN
  PERFORM set_config('app.allow_subscription_update', 'on', true);

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'missing order';
  END IF;
  IF p_pf_payment_id IS NULL OR length(trim(p_pf_payment_id)) < 3 THEN
    RAISE EXCEPTION 'missing pf_payment_id';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  SELECT * INTO existing
    FROM public.payment_history
    WHERE pf_payment_id = p_pf_payment_id
    LIMIT 1;

  SELECT * INTO ord
    FROM public.payment_orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF ord.user_id::text IS DISTINCT FROM p_user_id::text THEN
    RAISE EXCEPTION 'user mismatch';
  END IF;
  IF ord.amount_cents IS DISTINCT FROM p_amount_cents THEN
    RAISE EXCEPTION 'amount mismatch';
  END IF;

  IF ord.status = 'fulfilled' AND ord.pf_payment_id = p_pf_payment_id THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  IF existing.id IS NOT NULL AND ord.status = 'fulfilled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT subscription_expiry INTO cur_expiry
    FROM public.user_profiles
    WHERE user_id::text = ord.user_id::text;

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
  WHERE user_id::text = ord.user_id::text;

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 1 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF existing.id IS NULL THEN
    INSERT INTO public.payment_history (
      user_id, status, amount_gross, pf_payment_id, payment_status, item_name, provider, order_id
    ) VALUES (
      ord.user_id::text, 'success', p_amount_gross, p_pf_payment_id, 'COMPLETE',
      coalesce(p_item_name, ord.item_name), 'payfast', ord.id
    );
  END IF;

  UPDATE public.payment_orders
  SET status = 'fulfilled',
      pf_payment_id = p_pf_payment_id,
      fulfilled_at = now()
  WHERE id = ord.id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'expiry', new_expiry);
END;
$$;

NOTIFY pgrst, 'reload schema';
