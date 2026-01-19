
-- Mark legacy/test codes as Admin Only so they cannot be used publicly
UPDATE public.promo_codes
SET is_admin_only = true
WHERE code IN ('SUB', 'Finger', 'Test', 'ExpireMe', 'Master@12345');
