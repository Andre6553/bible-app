-- P0 security (Bible fikjnvkzhemamtlwsrin): exec_sql lockdown + user_profiles subscription guard
-- Apply via: node scripts/run_sql.js supabase/migrations/20261111190000_p0_security_hardening.sql

-- Ensure admin JWT helper exists (used by RLS elsewhere)
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean AS $$
BEGIN
  RETURN lower(coalesce(auth.jwt() ->> 'email', '')) = 'andre.ecprint@gmail.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- P0.1: Restrict exec_sql to service_role only
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- P0.3: Block owner updates to subscription/billing columns (service_role + admin JWT may change)
CREATE OR REPLACE FUNCTION public.guard_user_profile_subscription_fields()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin_jwt() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_override IS DISTINCT FROM OLD.subscription_override
     OR NEW.subscription_expiry IS DISTINCT FROM OLD.subscription_expiry
     OR NEW.last_renewal_month IS DISTINCT FROM OLD.last_renewal_month
  THEN
    RAISE EXCEPTION 'subscription fields are read-only for account owners';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_user_profile_subscription ON public.user_profiles;
CREATE TRIGGER guard_user_profile_subscription
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_subscription_fields();
