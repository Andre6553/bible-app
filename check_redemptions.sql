
SELECT user_id, promo_code, device_fingerprint, created_at 
FROM public.promo_redemptions 
ORDER BY created_at DESC 
LIMIT 10;
