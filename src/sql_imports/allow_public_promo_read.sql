-- Enable RLS on promo_codes if not already
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it conflicts
DROP POLICY IF EXISTS "Allow public read of public codes" ON promo_codes;

-- Create secure policy for public (Fetch BIBLE30 duration)
CREATE POLICY "Allow public read of public codes" 
ON promo_codes 
FOR SELECT 
TO public 
USING (is_admin_only = false AND is_active = true);

-- Drop existing admin policy
DROP POLICY IF EXISTS "Allow full access for admins" ON promo_codes;

-- Create admin policy (fixing text=uuid issue)
CREATE POLICY "Allow full access for admins"
ON promo_codes
FOR ALL
TO authenticated
USING (
  exists (
    select 1 from user_profiles
    where user_profiles.user_id = auth.uid()::text
    and user_profiles.subscription_override = 'admin'
  )
);
