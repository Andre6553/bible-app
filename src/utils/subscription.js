/**
 * Premium access matches SubscriptionPage, Profile, and AI quota checks:
 * override in premium/admin/tester, tier premium, or unexpired subscription_expiry.
 * When freeMode is on, any logged-in user (user present) is treated as premium.
 */
export function isPremiumProfile(profile, { freeMode = false, user = null } = {}) {
    if (freeMode && user) return true;
    if (!profile) return false;

    const override = profile.subscription_override;
    const expiry = profile.subscription_expiry;

    return (
        profile.subscription_tier === 'premium' ||
        override === 'premium' ||
        override === 'admin' ||
        override === 'tester' ||
        (expiry && new Date(expiry) > new Date())
    );
}

/**
 * Search subscribe promo: guests and free users only.
 * Hide while profile is loading for a logged-in user to avoid a flash.
 * Hidden entirely while app-wide free mode is enabled.
 */
export function shouldShowSubscriptionPromo({ user, profile, profileLoading, freeMode = false }) {
    if (freeMode) return false;
    if (profileLoading && user) return false;
    if (!user) return true;
    return !isPremiumProfile(profile, { freeMode, user });
}
