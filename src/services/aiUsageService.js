import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';
import { ensureFreeModeLoaded } from './appSettingsService';
import { resolveAiUsageLimit } from '../utils/aiUsageLimits';

/**
 * Atomically reserve one AI call against the user limit.
 * Failed provider requests still consume the reservation (no refund).
 */
export async function reserveAiUsage() {
    const userId = await getUserId();
    if (!userId) throw new Error('User not logged in');

    const isGuest = userId.startsWith('user_');
    const freeMode = await ensureFreeModeLoaded();

    if (isGuest) {
        const { count, error } = await supabase
            .from('api_usage_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        if (error) throw error;
        const limit = resolveAiUsageLimit(null, { freeMode, userId, isGuest: true });
        if ((count || 0) >= limit) {
            throw new Error('AI_LIMIT_EXCEEDED');
        }
        return true;
    }

    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_override, subscription_expiry, ai_usage_count')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;

    const limit = resolveAiUsageLimit(profile, { freeMode, userId, isGuest: false });
    const { error: resErr } = await supabase.rpc('reserve_ai_usage', { p_limit: limit });
    if (resErr) {
        const msg = resErr.message || '';
        if (msg.includes('AI_LIMIT_EXCEEDED')) {
            throw new Error('AI_LIMIT_EXCEEDED');
        }
        throw resErr;
    }
    return true;
}

export async function getRemainingAiUsage(userId) {
    const id = userId || (await getUserId());
    const isGuest = !id || id.startsWith('user_');
    const freeMode = await ensureFreeModeLoaded();

    if (isGuest) {
        const limit = resolveAiUsageLimit(null, { freeMode, userId: id, isGuest: true });
        const { count } = await supabase
            .from('api_usage_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id);
        const used = count || 0;
        return { remaining: Math.max(0, limit - used), used, quota: limit, isPremium: false };
    }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_override, subscription_expiry, ai_usage_count')
        .eq('user_id', id)
        .single();

    const limit = resolveAiUsageLimit(profile, { freeMode, userId: id, isGuest: false });
    const used = profile?.ai_usage_count || 0;
    const isPremium = limit >= 999999;
    return {
        remaining: isPremium ? 999999 : Math.max(0, limit - used),
        used,
        quota: limit,
        isPremium,
    };
}
