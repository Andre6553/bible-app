-- FORCE ADMIN PERMISSIONS
-- This script ensures the master admin has the correct DB flags.

UPDATE public.user_profiles
SET subscription_override = 'admin'
WHERE email = 'andre.ecprint@gmail.com';

-- Verify the result
SELECT id, email, subscription_override 
FROM public.user_profiles 
WHERE email = 'andre.ecprint@gmail.com';
