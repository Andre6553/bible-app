import { supabase } from '../config/supabaseClient';

export const FREE_MODE_KEY = 'free_mode';

let cachedFreeMode = false;
let freeModeLoadPromise = null;

export function getCachedFreeMode() {
    return cachedFreeMode;
}

export function setCachedFreeMode(enabled) {
    cachedFreeMode = Boolean(enabled);
}

/**
 * Load free_mode once per session; safe default false on error.
 */
export async function ensureFreeModeLoaded() {
    if (freeModeLoadPromise) {
        await freeModeLoadPromise;
        return cachedFreeMode;
    }

    freeModeLoadPromise = (async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', FREE_MODE_KEY)
                .maybeSingle();

            if (!error && data?.value != null) {
                setCachedFreeMode(data.value === 'true');
            }
        } catch (err) {
            console.warn('[AppSettings] Failed to load free_mode:', err?.message || err);
            setCachedFreeMode(false);
        }
    })();

    await freeModeLoadPromise;
    return cachedFreeMode;
}

export async function fetchFreeModeSetting() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', FREE_MODE_KEY)
            .maybeSingle();

        if (error) throw error;

        const enabled = data?.value === 'true';
        setCachedFreeMode(enabled);
        return { success: true, enabled };
    } catch (error) {
        console.error('Error fetching free_mode:', error);
        return { success: false, enabled: false, error: error.message };
    }
}

export async function updateFreeModeSetting(enabled) {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: FREE_MODE_KEY,
                value: enabled ? 'true' : 'false',
                description: 'When true, all logged-in users receive premium access; subscription UI is hidden',
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        setCachedFreeMode(enabled);
        return { success: true, enabled };
    } catch (error) {
        console.error('Error updating free_mode:', error);
        return { success: false, error: error.message };
    }
}
