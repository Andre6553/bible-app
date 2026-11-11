-- PayFast hides card / Instant EFT below ~R5; only Mobicred remains.
-- Charge at least R5.00 so those methods appear.

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
  prior int;
  cents int;
  item text;
  oid uuid;
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
    IF snap.discount_eligible THEN
      SELECT COUNT(*)::int INTO prior
        FROM public.payment_history
        WHERE user_id::text = uid_text AND status = 'success';

      IF prior = 0 THEN
        cents := GREATEST(snap.full_zar_cents / 2, 500);
        item := 'Omni Bible Subscription (50% Off)';
      ELSE
        cents := GREATEST(snap.full_zar_cents, 500);
        item := 'Omni Bible Subscription';
      END IF;
    ELSE
      cents := GREATEST(snap.full_zar_cents, 500);
      item := 'Omni Bible Subscription';
    END IF;
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

    SELECT COUNT(*)::int INTO prior
      FROM public.payment_history
      WHERE user_id::text = uid_text AND status = 'success';

    IF prior > 0 THEN
      cents := GREATEST(full_rands * 100, 500);
      item := 'Omni Bible Subscription';
    ELSE
      cents := GREATEST((full_rands / 2) * 100, 500);
      item := 'Omni Bible Subscription (50% Off)';
    END IF;
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
