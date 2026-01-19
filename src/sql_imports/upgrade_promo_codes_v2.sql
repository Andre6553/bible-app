-- Upgrade Promo Codes System (V2)

-- 1. Modify promo_codes table to support expiration and constraints
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1000000,
ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0;

-- 2. Create tracking table for redemptions (Anti-Abuse)
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID REFERENCES public.promo_codes(id),
    user_id UUID REFERENCES auth.users(id),
    promo_code TEXT NOT NULL,
    device_fingerprint TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on tracking table
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage all redemptions
CREATE POLICY "Admins can view all redemptions" 
ON public.promo_redemptions
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_profiles.user_id = auth.uid()::text 
        AND user_profiles.subscription_override = 'admin'
    )
);

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions" 
ON public.promo_redemptions
TO authenticated
USING (user_id = auth.uid());


-- 3. Secure Redemption Function (The Gatekeeper)
CREATE OR REPLACE FUNCTION public.redeem_promo_code_v2(
    code_input TEXT,
    fingerprint_input TEXT,
    ip_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to check other users' data
SET search_path = public
AS $$
DECLARE
    found_code RECORD;
    user_id UUID;
    existing_redemption RECORD;
    device_count INTEGER;
    ip_count INTEGER;
    new_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    user_id := auth.uid();
    
    -- A. Validate Input
    IF user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please log in first.');
    END IF;

    -- B. Find the Code
    SELECT * INTO found_code FROM public.promo_codes 
    WHERE code = code_input AND is_active = true 
    LIMIT 1;

    IF found_code IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid code.');
    END IF;

    -- C. Check Expiration Date
    IF found_code.valid_until IS NOT NULL AND found_code.valid_until < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'This code has expired.');
    END IF;

    -- D. Check Global Usage Limit
    IF found_code.current_uses >= found_code.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'This code has reached its maximum usage limit.');
    END IF;

    -- E. Check: Has User already used THIS specific code?
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE user_id = auth.uid() AND promo_code = code_input) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code.');
    END IF;

    -- F. Check: Device Limit (Strict: 1 redemption per device for THIS code)
    IF fingerprint_input IS NOT NULL AND length(fingerprint_input) > 5 THEN
        SELECT COUNT(*) INTO device_count FROM public.promo_redemptions 
        WHERE promo_code = code_input AND device_fingerprint = fingerprint_input;
        
        IF device_count >= 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'This specific promo code has already been used on this device. Limit is 1 per device.');
        END IF;
    END IF;

    -- G. Check: IP Limit (Permissive: 4 redemptions per IP for THIS code)
    IF ip_input IS NOT NULL AND length(ip_input) > 5 THEN
        SELECT COUNT(*) INTO ip_count FROM public.promo_redemptions 
        WHERE promo_code = code_input AND ip_address = ip_input;
        
        IF ip_count >= 4 THEN
            RETURN jsonb_build_object('success', false, 'error', 'This promo code has been used too many times (4) from this IP address.');
        END IF;
    END IF;

    -- H. ALL CHECKS PASSED -> EXECUTE REDEMPTION

    -- 1. Insert Redemption Record
    INSERT INTO public.promo_redemptions (promo_code_id, user_id, promo_code, device_fingerprint, ip_address)
    VALUES (found_code.id, user_id, code_input, fingerprint_input, ip_input);

    -- 2. Increment Usage Count
    UPDATE public.promo_codes SET current_uses = current_uses + 1 WHERE id = found_code.id;

    -- 3. Update User Profile (Apply Benefits)
    -- Logic: If already expiring in future, ADD days. If expired or null, set to NOW + days.
    
    SELECT subscription_expiry INTO new_expiry FROM public.user_profiles WHERE user_id = auth.uid()::text;
    
    IF new_expiry IS NULL OR new_expiry < NOW() THEN
        new_expiry := NOW() + (found_code.duration_days || ' days')::INTERVAL;
    ELSE
        new_expiry := new_expiry + (found_code.duration_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.user_profiles 
    SET 
        subscription_tier = 'premium', -- Upgrade to premium
        subscription_override = 'premium', -- Force override to ensure access
        subscription_expiry = new_expiry
    WHERE user_id = auth.uid()::text;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Code redeemed successfully! Valid until: ' || to_char(new_expiry, 'YYYY-MM-DD'),
        'new_expiry', new_expiry
    );
END;
$$;
