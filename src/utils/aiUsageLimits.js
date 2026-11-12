import { isPremiumProfile } from './subscription';

export const GUEST_AI_LIMIT = 10;
export const FREE_AI_LIMIT = 50;
export const TESTER_AI_LIMIT = 500;
export const UNLIMITED_AI_LIMIT = 999999;

export function resolveAiUsageLimit(profile, { freeMode = false, userId = null, isGuest = false } = {}) {
    if (isGuest) return GUEST_AI_LIMIT;
    const override = (profile?.subscription_override || '').trim().toLowerCase();
    if (override === 'tester') return TESTER_AI_LIMIT;
    if (override === 'admin') return UNLIMITED_AI_LIMIT;
    if (isPremiumProfile(profile, { freeMode, user: userId ? { id: userId } : null })) {
        return UNLIMITED_AI_LIMIT;
    }
    return FREE_AI_LIMIT;
}

/**
 * Pure concurrent-safe reservation: increment only if still under limit.
 * Failed provider calls still consume a reserved slot (prevents retry storms).
 */
export function tryReserveUsage(currentUsage, limit) {
    const used = Number(currentUsage) || 0;
    const cap = Number(limit) || 0;
    if (used >= cap) {
        return { ok: false, next: used };
    }
    return { ok: true, next: used + 1 };
}
