-- Allow Testers to use Secret Codes
-- Currently only 'admin' can read the table. We need 'tester' too.

DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;

CREATE POLICY "Admins and Testers can view promo codes" 
ON public.promo_codes
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_profiles.user_id = auth.uid()::text 
        AND user_profiles.subscription_override IN ('admin', 'tester')
    )
);
