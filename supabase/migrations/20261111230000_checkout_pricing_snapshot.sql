-- Match PayFast amount to on-screen ZAR (USD × live rate), not hardcoded 85

CREATE TABLE IF NOT EXISTS public.checkout_pricing_snapshots (
  user_id text PRIMARY KEY,
  full_zar_cents integer NOT NULL CHECK (full_zar_cents > 0),
  discount_eligible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_pricing_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_pricing_own ON public.checkout_pricing_snapshots;
CREATE POLICY checkout_pricing_own ON public.checkout_pricing_snapshots
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.save_checkout_pricing_snapshot(
  p_full_zar integer,
  p_discount_eligible boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_text text := auth.uid()::text;
  cents int;
BEGIN
  IF uid_text IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_full_zar IS NULL OR p_full_zar < 1 OR p_full_zar > 9999 THEN
    RAISE EXCEPTION 'invalid list price';
  END IF;

  cents := p_full_zar * 100;

  INSERT INTO public.checkout_pricing_snapshots (user_id, full_zar_cents, discount_eligible, updated_at)
  VALUES (uid_text, cents, coalesce(p_discount_eligible, true), now())
  ON CONFLICT (user_id) DO UPDATE SET
    full_zar_cents = EXCLUDED.full_zar_cents,
    discount_eligible = EXCLUDED.discount_eligible,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_checkout_pricing_snapshot(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_checkout_pricing_snapshot(integer, boolean) TO authenticated;

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
        cents := GREATEST(snap.full_zar_cents / 2, 100);
        item := 'Omni Bible Subscription (50% Off)';
      ELSE
        cents := snap.full_zar_cents;
        item := 'Omni Bible Subscription';
      END IF;
    ELSE
      cents := snap.full_zar_cents;
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
      cents := full_rands * 100;
      item := 'Omni Bible Subscription';
    ELSE
      cents := GREATEST((full_rands / 2) * 100, 100);
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
