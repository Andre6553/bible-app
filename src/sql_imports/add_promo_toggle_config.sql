
-- Add Global Promo Code Toggle Setting
INSERT INTO public.app_config (key, value)
VALUES ('promo_codes_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
