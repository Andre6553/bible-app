/**
 * Premium access matches SubscriptionPage, Profile, and AI quota checks:
 * override in premium/admin/tester, tier premium, or unexpired subscription_expiry.
 */
export function isPremiumProfile(profile) {
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
 */
export function shouldShowSubscriptionPromo({ user, profile, profileLoading }) {
    if (profileLoading && user) return false;
    if (!user) return true;
    return !isPremiumProfile(profile);
}
