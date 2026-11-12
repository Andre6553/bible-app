-- Keep the existing guard_user_profile_subscription_fields implementation,
-- including its trusted subscription-update path used by existing RPCs.
drop trigger if exists prevent_profile_role_escalation on public.user_profiles;
drop function if exists public.prevent_profile_role_escalation();
