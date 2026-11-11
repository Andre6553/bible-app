-- Second live R5 payment 2026-11-11 20:55 UTC; ITN still did not fulfill.
-- PayFast payer email is not used; order is on omnibible@gmail.com user id.

DO $$
DECLARE
  uid_text text := '297735fd-1f79-4443-8240-67e716079f13';
  oid uuid := '641b3471-b108-41a8-97a2-b95b193e0246';
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
    pf_payment_id = coalesce(nullif(pf_payment_id, ''), 'manual-itn-miss-20261111-r5b'),
    fulfilled_at = coalesce(fulfilled_at, now())
  WHERE id = oid
    AND user_id::text = uid_text
    AND status = 'pending';

  INSERT INTO public.payment_history (
    user_id, status, amount_gross, pf_payment_id, payment_status, item_name, provider, order_id
  )
  SELECT
    uid_text::uuid, 'success', 5.00, 'manual-itn-miss-20261111-r5b', 'COMPLETE',
    'Omni Bible Subscription (50% Off)', 'payfast', oid
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_history WHERE pf_payment_id = 'manual-itn-miss-20261111-r5b'
  );
END $$;
