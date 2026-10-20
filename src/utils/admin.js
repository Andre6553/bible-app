/**
 * Matches Supabase public.check_is_admin() — master email or admin tier/override.
 */
export function isAppAdmin(user, profile) {
    const email = user?.email?.toLowerCase();
    if (email === 'andre.ecprint@gmail.com') return true;
    if (profile?.subscription_override === 'admin') return true;
    if (profile?.subscription_tier === 'admin') return true;
    return false;
}
