import { supabase } from '../config/supabaseClient';

export const FREE_MODE_KEY = 'free_mode';
export const SERMON_PREP_ENABLED_KEY = 'sermon_prep_enabled';

let cachedFreeMode = false;
let cachedSermonPrepEnabled = false;
let appSettingsLoadPromise = null;

export function getCachedFreeMode() {
    return cachedFreeMode;
}

export function setCachedFreeMode(enabled) {
    cachedFreeMode = Boolean(enabled);
}

export function getCachedSermonPrepEnabled() {
    return cachedSermonPrepEnabled;
}

export function setCachedSermonPrepEnabled(enabled) {
    cachedSermonPrepEnabled = Boolean(enabled);
}

function applySettingsRows(rows) {
    if (!rows?.length) return;
    for (const row of rows) {
        if (row.key === FREE_MODE_KEY) {
            setCachedFreeMode(row.value === 'true');
        }
        if (row.key === SERMON_PREP_ENABLED_KEY) {
            setCachedSermonPrepEnabled(row.value === 'true');
        }
    }
}

/**
 * Load free_mode and sermon_prep_enabled once per session; safe defaults on error.
 */
export async function ensureAppSettingsLoaded() {
    if (appSettingsLoadPromise) {
        await appSettingsLoadPromise;
        return {
            freeMode: cachedFreeMode,
            sermonPrepEnabled: cachedSermonPrepEnabled
        };
    }

    appSettingsLoadPromise = (async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', [FREE_MODE_KEY, SERMON_PREP_ENABLED_KEY]);

            if (!error && data) {
                applySettingsRows(data);
            }
        } catch (err) {
            console.warn('[AppSettings] Failed to load app settings:', err?.message || err);
            setCachedFreeMode(false);
            setCachedSermonPrepEnabled(false);
        }
    })();

    await appSettingsLoadPromise;
    return {
        freeMode: cachedFreeMode,
        sermonPrepEnabled: cachedSermonPrepEnabled
    };
}

/**
 * Load free_mode once per session; safe default false on error.
 */
export async function ensureFreeModeLoaded() {
    const { freeMode } = await ensureAppSettingsLoaded();
    return freeMode;
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

export async function fetchSermonPrepEnabledSetting() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SERMON_PREP_ENABLED_KEY)
            .maybeSingle();

        if (error) throw error;

        const enabled = data?.value === 'true';
        setCachedSermonPrepEnabled(enabled);
        return { success: true, enabled };
    } catch (error) {
        console.error('Error fetching sermon_prep_enabled:', error);
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

export async function updateSermonPrepEnabledSetting(enabled) {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: SERMON_PREP_ENABLED_KEY,
                value: enabled ? 'true' : 'false',
                description: 'When true, Sermon Preparation is visible to all users; when false, admins only',
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        setCachedSermonPrepEnabled(enabled);
        return { success: true, enabled };
    } catch (error) {
        console.error('Error updating sermon_prep_enabled:', error);
        return { success: false, error: error.message };
    }
}
