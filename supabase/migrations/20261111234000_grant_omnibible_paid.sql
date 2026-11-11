-- Manual fulfill: PayFast charged omnibible@gmail.com but ITN did not mark the order.
-- Latest pending order 2026-11-11 20:35 UTC, R5.00 (50% off).

DO $$
DECLARE
  uid_text text := '297735fd-1f79-4443-8240-67e716079f13';
  oid uuid := 'b34ce1d2-3684-4d3f-90e2-b306721d570b';
  rows int;
BEGIN
  PERFORM set_config('app.allow_subscription_update', 'on', true);

  UPDATE public.user_profiles
  SET
    subscription_tier = 'premium',
    subscription_override = 'premium',
    subscription_expiry = now() + interval '30 days',
    last_renewal_month = to_char(now(), 'YYYY-MM')
  WHERE user_id::text = uid_text;

  GET DIAGNOSTICS rows = ROW_COUNT;
  IF rows <> 1 THEN
    RAISE EXCEPTION 'profile not updated';
  END IF;

  UPDATE public.payment_orders
  SET
    status = 'fulfilled',
    pf_payment_id = coalesce(nullif(pf_payment_id, ''), 'manual-itn-miss-20261111'),
    fulfilled_at = coalesce(fulfilled_at, now())
  WHERE id = oid
    AND user_id::text = uid_text
    AND status = 'pending';

  INSERT INTO public.payment_history (
    user_id, status, amount_gross, pf_payment_id, payment_status, item_name, provider, order_id
  )
  SELECT
    uid_text::uuid, 'success', 5.00, 'manual-itn-miss-20261111', 'COMPLETE',
    'Omni Bible Subscription (50% Off)', 'payfast', oid
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_history WHERE pf_payment_id = 'manual-itn-miss-20261111'
  );
END $$;
