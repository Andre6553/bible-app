
INSERT INTO public.app_config (key, value, description)
VALUES ('base_subscription_price_usd', '5.00', 'Base monthly subscription price in USD')
ON CONFLICT (key) DO NOTHING;
