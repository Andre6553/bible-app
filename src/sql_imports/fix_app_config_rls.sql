
-- 1. Ensure app_config table exists
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT
);

-- 2. Insert the subscription price if missing
INSERT INTO public.app_config (key, value, description)
VALUES ('base_subscription_price_usd', '5.00', 'Base monthly subscription price in USD')
ON CONFLICT (key) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 4. Allow PUBLIC read access (needed for Subscription Page)
DROP POLICY IF EXISTS "Allow public read access" ON public.app_config;
CREATE POLICY "Allow public read access" ON public.app_config
    FOR SELECT
    USING (true);

-- 5. Allow Admin write access
DROP POLICY IF EXISTS "Allow admin write access" ON public.app_config;
CREATE POLICY "Allow admin write access" ON public.app_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.user_id = auth.uid()::text 
            AND user_profiles.subscription_override = 'admin'
        )
    );
