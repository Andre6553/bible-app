-- Enable RLS on app_errors if not already enabled
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- 1. Grant generic access to the table for anon and authenticated
GRANT INSERT ON public.app_errors TO anon, authenticated, service_role;
GRANT SELECT ON public.app_errors TO anon, authenticated, service_role; -- Needed for some clients to read back? Usually not.

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.app_errors;
DROP POLICY IF EXISTS "Enable select for admins only" ON public.app_errors;
DROP POLICY IF EXISTS "Enable all for dashboard" ON public.app_errors;

-- 3. Create Policy: Allow INSERT for everyone (Anon + Auth)
-- We need anon to log login failures or crash dumps before auth.
CREATE POLICY "Enable insert for everyone" 
ON public.app_errors 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- 4. Create Policy: Allow SELECT for Admins only
-- Only admins should read the error logs.
CREATE POLICY "Enable select for admins only" 
ON public.app_errors 
FOR SELECT 
TO authenticated 
USING (
    public.is_admin_jwt() = true 
    OR 
    auth.email() = 'andre.ecprint@gmail.com'
);

-- 5. Create Policy: Allow DELETE for Admins only
CREATE POLICY "Enable delete for admins only" 
ON public.app_errors 
FOR DELETE 
TO authenticated 
USING (
    public.is_admin_jwt() = true 
    OR 
    auth.email() = 'andre.ecprint@gmail.com'
);
