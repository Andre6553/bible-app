
-- Upgrade Promo Codes System (V3) - Admin Only Logic

-- 1. Add 'is_admin_only' flag to promo_codes
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS is_admin_only BOOLEAN DEFAULT FALSE;

-- 2. Update Public Redemption Function to BLOCK admin-only codes
CREATE OR REPLACE FUNCTION public.redeem_promo_code_v2(
    code_input TEXT,
    fingerprint_input TEXT,
    ip_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive code.');
    END IF;

    -- [NEW CHECK] Block Admin Only Codes
    IF found_code.is_admin_only THEN
        RETURN jsonb_build_object('success', false, 'error', 'This code cannot be redeemed here. Contact support.');
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
            RETURN jsonb_build_object('success', false, 'error', 'This specific promo code has already been used on this device.');
        END IF;
    END IF;

    -- G. Check: IP Limit (Permissive: 4 redemptions per IP for THIS code)
    IF ip_input IS NOT NULL AND length(ip_input) > 5 THEN
        SELECT COUNT(*) INTO ip_count FROM public.promo_redemptions 
        WHERE promo_code = code_input AND ip_address = ip_input;
        
        IF ip_count >= 4 THEN
            RETURN jsonb_build_object('success', false, 'error', 'This promo code has been used too many times from this IP address.');
        END IF;
    END IF;

    -- H. ALL CHECKS PASSED -> EXECUTE REDEMPTION
    INSERT INTO public.promo_redemptions (promo_code_id, user_id, promo_code, device_fingerprint, ip_address)
    VALUES (found_code.id, user_id, code_input, fingerprint_input, ip_input);

    UPDATE public.promo_codes SET current_uses = current_uses + 1 WHERE id = found_code.id;

    -- Update User Profile Logic
    SELECT subscription_expiry INTO new_expiry FROM public.user_profiles WHERE user_id = auth.uid()::text;
    
    IF new_expiry IS NULL OR new_expiry < NOW() THEN
        new_expiry := NOW() + (found_code.duration_days || ' days')::INTERVAL;
    ELSE
        new_expiry := new_expiry + (found_code.duration_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.user_profiles 
    SET subscription_tier = 'premium', subscription_override = 'premium', subscription_expiry = new_expiry
    WHERE user_id = auth.uid()::text;

    RETURN jsonb_build_object('success', true, 'message', 'Code redeemed successfully!', 'new_expiry', new_expiry);
END;
$$;


-- 3. NEW RPC: Admin Apply Promo Code (Secure Admin-Only Function)
CREATE OR REPLACE FUNCTION public.admin_apply_promo_code(
    target_user_id UUID,
    code_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_is_admin BOOLEAN;
    found_code RECORD;
    new_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Security Check: Is the CALLER an admin?
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid()::text 
        AND subscription_override = 'admin'
    ) INTO caller_is_admin;

    IF NOT caller_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required.');
    END IF;

    -- 2. Find the Code (Allows Admin-Only codes)
    SELECT * INTO found_code FROM public.promo_codes 
    WHERE code = code_input AND is_active = true 
    LIMIT 1;

    IF found_code IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive code.');
    END IF;

    -- 3. Check: Has Target User already used THIS specific code?
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE user_id = target_user_id AND promo_code = code_input) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This user has already redeemed this code.');
    END IF;

    -- 4. Apply Redemption (Skip IP/Device checks for Admins)
    INSERT INTO public.promo_redemptions (promo_code_id, user_id, promo_code, device_fingerprint, ip_address)
    VALUES (found_code.id, target_user_id, code_input, 'admin-manual-override', 'admin-manual-override');

    UPDATE public.promo_codes SET current_uses = current_uses + 1 WHERE id = found_code.id;

    -- 5. Calculate Expiry
    SELECT subscription_expiry INTO new_expiry FROM public.user_profiles WHERE user_id = target_user_id::text;
    
    IF new_expiry IS NULL OR new_expiry < NOW() THEN
        new_expiry := NOW() + (found_code.duration_days || ' days')::INTERVAL;
    ELSE
        new_expiry := new_expiry + (found_code.duration_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.user_profiles 
    SET subscription_tier = 'premium', subscription_override = 'premium', subscription_expiry = new_expiry
    WHERE user_id = target_user_id::text;

    RETURN jsonb_build_object('success', true, 'message', 'Code applied to user successfully!');
END;
$$;
