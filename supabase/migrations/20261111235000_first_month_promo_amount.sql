-- First month is the intro promo (card: list R10 → pay R5). Do not bump to
-- full list because payment_history already has a row (test / ITN grant).

CREATE OR REPLACE FUNCTION public.create_payment_order()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uid_text text := auth.uid()::text;
  snap record;
  full_rands int;
  usd numeric;
  zar_rate numeric;
  cents int;
  item text;
  oid uuid;
  intro boolean := true;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT full_zar_cents, discount_eligible
    INTO snap
    FROM public.checkout_pricing_snapshots
    WHERE user_id = uid_text
      AND updated_at > now() - interval '2 hours';

  IF FOUND THEN
    full_rands := snap.full_zar_cents / 100;
    intro := coalesce(snap.discount_eligible, true);
  ELSE
    SELECT COALESCE(NULLIF(trim(value), '')::numeric, 5)
      INTO usd
      FROM public.app_config
      WHERE key = 'base_subscription_price_usd';

    SELECT COALESCE(NULLIF(trim(value), '')::numeric, 18.5)
      INTO zar_rate
      FROM public.app_config
      WHERE key = 'last_usd_zar_rate';

    full_rands := GREATEST(round(usd * zar_rate)::int, 1);
    intro := true;
  END IF;

  IF intro THEN
    -- Card shows 50% off list; PayFast cards need ≥ R5.
    cents := GREATEST(full_rands * 50, 500);
    item := 'Omni Bible Subscription (50% Off)';
  ELSE
    cents := GREATEST(full_rands * 100, 500);
    item := 'Omni Bible Subscription';
  END IF;

  INSERT INTO public.payment_orders (user_id, amount_cents, item_name)
  VALUES (uid_text, cents, item)
  RETURNING id INTO oid;

  RETURN jsonb_build_object(
    'order_id', oid,
    'amount', to_char(cents / 100.0, 'FM999999990.00'),
    'amount_cents', cents,
    'item_name', item,
    'list_zar', full_rands
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
