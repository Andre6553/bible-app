-- Create a secure table for administrative promo/secret codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    action TEXT NOT NULL, -- 'admin', 'premium', 'tester', 'reset'
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Only Admins (subscription_override === 'admin') can see or manage this table
CREATE POLICY "Admins can manage promo codes" 
ON public.promo_codes
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_profiles.user_id = auth.uid()::text 
        AND user_profiles.subscription_override = 'admin'
    )
);

-- Insert the default codes that were previously hardcoded
INSERT INTO public.promo_codes (code, action, description)
VALUES 
    ('Master@12345', 'admin', 'Full Master Admin Access'),
    ('SUB', 'premium', '30 Days Premium Subscription'),
    ('Finger', 'tester_finger', 'Tester Access with Fingerprint reset'),
    ('Test', 'tester', 'Standard Tester Access'),
    ('ExpireMe', 'reset', 'Reset all overrides to free tier')
ON CONFLICT (code) DO NOTHING;
