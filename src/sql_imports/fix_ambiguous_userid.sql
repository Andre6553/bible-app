
-- Fix Ambiguous Column Reference in redeem_promo_code_v2

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
    v_user_id UUID; -- Renamed from user_id to prevent ambiguity
    existing_redemption RECORD;
    device_count INTEGER;
    ip_count INTEGER;
    new_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    v_user_id := auth.uid();
    
    -- A. Validate Input
    IF v_user_id IS NULL THEN
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
    -- Explicitly qualify table column public.promo_redemptions.user_id to be safe
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE user_id = v_user_id AND promo_code = code_input) THEN
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
    VALUES (found_code.id, v_user_id, code_input, fingerprint_input, ip_input);

    UPDATE public.promo_codes SET current_uses = current_uses + 1 WHERE id = found_code.id;

    -- Update User Profile Logic
    SELECT subscription_expiry INTO new_expiry FROM public.user_profiles WHERE user_id = v_user_id::text;
    
    IF new_expiry IS NULL OR new_expiry < NOW() THEN
        new_expiry := NOW() + (found_code.duration_days || ' days')::INTERVAL;
    ELSE
        new_expiry := new_expiry + (found_code.duration_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.user_profiles 
    SET subscription_tier = 'premium', subscription_override = 'premium', subscription_expiry = new_expiry
    WHERE user_id = v_user_id::text;

    RETURN jsonb_build_object('success', true, 'message', 'Code redeemed successfully!', 'new_expiry', new_expiry);
END;
$$;
