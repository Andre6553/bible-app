-- P0 PayFast ITN: server orders + atomic fulfill (Bible fikjnvkzhemamtlwsrin)
-- Apply: node scripts/run_sql.js supabase/migrations/20261111210000_p0_payfast_itn.sql

CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean AS $$
BEGIN
  RETURN lower(coalesce(auth.jwt() ->> 'email', '')) = 'andre.ecprint@gmail.com';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.guard_user_profile_subscription_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_subscription_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin_jwt() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.subscription_tier := coalesce(NEW.subscription_tier, 'free');
    IF coalesce(NEW.subscription_tier, 'free') NOT IN ('free', '')
       OR NEW.subscription_override IS NOT NULL
       OR NEW.subscription_expiry IS NOT NULL THEN
      NEW.subscription_tier := 'free';
      NEW.subscription_override := NULL;
      NEW.subscription_expiry := NULL;
      NEW.last_renewal_month := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_override IS DISTINCT FROM OLD.subscription_override
     OR NEW.subscription_expiry IS DISTINCT FROM OLD.subscription_expiry
     OR NEW.last_renewal_month IS DISTINCT FROM OLD.last_renewal_month THEN
    RAISE EXCEPTION 'subscription fields are read-only for account owners';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_user_profile_subscription ON public.user_profiles;
CREATE TRIGGER guard_user_profile_subscription
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_subscription_fields();

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  item_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  pf_payment_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);

ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS order_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_pf_payment_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.payment_history
        ADD CONSTRAINT payment_history_pf_payment_id_key UNIQUE (pf_payment_id);
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
END $$;

INSERT INTO public.app_config (key, value)
VALUES ('subscription_price_zar', '85')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_orders_select_own ON public.payment_orders;
CREATE POLICY payment_orders_select_own ON public.payment_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

REVOKE ALL ON public.payment_orders FROM anon, authenticated;
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;

CREATE OR REPLACE FUNCTION public.create_payment_order()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
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
    WHERE user_id::text = uid::text AND status = 'success';

  IF prior > 0 THEN
    cents := full_rands * 100;
    item := 'Omni Bible Subscription';
  ELSE
    cents := GREATEST((full_rands / 2) * 100, 100);
    item := 'Omni Bible Subscription (50% Off)';
  END IF;

  INSERT INTO public.payment_orders (user_id, amount_cents, item_name)
  VALUES (uid::text, cents, item)
  RETURNING id INTO oid;

  RETURN jsonb_build_object(
    'order_id', oid,
    'amount', to_char(cents / 100.0, 'FM999999990.00'),
    'amount_cents', cents,
    'item_name', item
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_order() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_order() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_order() TO service_role;

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

  IF ord.user_id IS DISTINCT FROM p_user_id THEN
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
    WHERE user_id = ord.user_id;

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
  WHERE user_id = ord.user_id;

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 1 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF existing.id IS NULL THEN
    INSERT INTO public.payment_history (
      user_id, status, amount_gross, pf_payment_id, payment_status, item_name, provider, order_id
    ) VALUES (
      ord.user_id, 'success', p_amount_gross, p_pf_payment_id, 'COMPLETE',
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

REVOKE ALL ON FUNCTION public.fulfill_payfast_itn(uuid, text, int, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fulfill_payfast_itn(uuid, text, int, text, text, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_payfast_itn(uuid, text, int, text, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
