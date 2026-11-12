import { supabase } from '../config/supabaseClient';

/**
 * Migration Service
 * Transfers data from anonymous `bible_user_id` to authenticated Supabase user ID.
 */

export const MIGRATION_STATE_KEY = 'omni_migration_v1';
const GUEST_ID_KEY = 'bible_user_id';
const MIGRATION_TIMEOUT_MS = 30000;

export const TABLES_TO_MIGRATE = [
    'verse_highlights',
    'verse_notes',
    'study_collections',
    'highlight_categories',
    'user_labels',
    'word_studies',
    'inductive_studies',
    'search_logs',
    'ai_questions',
    'devotional_history',
    'sermons',
    'user_settings',
    'user_reading_plans',
    'user_plan_events',
    'user_plan_profiles',
];

const READING_PLAN_TABLE = 'user_reading_plans';

export function getMigrationState() {
    try {
        const raw = localStorage.getItem(MIGRATION_STATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveMigrationState(state) {
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
}

export function clearMigrationState() {
    localStorage.removeItem(MIGRATION_STATE_KEY);
}

function initMigrationState(guestId, authUserId) {
    const state = {
        guestId,
        authUserId,
        tables: {},
        startedAt: new Date().toISOString(),
        completedAt: null,
    };
    saveMigrationState(state);
    return state;
}

function recordTableResult(table, ok, extra = {}) {
    const state = getMigrationState() || {};
    state.tables = state.tables || {};
    state.tables[table] = { ok, ...extra, at: new Date().toISOString() };
    saveMigrationState(state);
}

/**
 * Only clear guest ID when migration fully succeeded or guest truly has no data.
 */
export function clearGuestIdAfterSuccess() {
    localStorage.removeItem(GUEST_ID_KEY);
    const state = getMigrationState();
    if (state) {
        state.completedAt = new Date().toISOString();
        saveMigrationState(state);
    }
}

async function mergeReadingPlans(oldUserId, newUserId) {
    const { data: guestRows, error: fetchErr } = await supabase
        .from(READING_PLAN_TABLE)
        .select('*')
        .eq('user_id', oldUserId);

    if (fetchErr) {
        return { table: READING_PLAN_TABLE, success: false, error: fetchErr.message };
    }

    let moved = 0;
    let merged = 0;

    for (const guest of guestRows || []) {
        const { data: existing } = await supabase
            .from(READING_PLAN_TABLE)
            .select('*')
            .eq('user_id', newUserId)
            .eq('plan_id', guest.plan_id)
            .maybeSingle();

        if (existing) {
            const mergedDays = [
                ...new Set([...(existing.completed_days || []), ...(guest.completed_days || [])]),
            ].sort((a, b) => a - b);
            const mergedNotes = { ...(existing.day_notes || {}), ...(guest.day_notes || {}) };
            const currentDay = Math.max(existing.current_day || 1, guest.current_day || 1);

            await supabase
                .from(READING_PLAN_TABLE)
                .update({
                    completed_days: mergedDays,
                    day_notes: mergedNotes,
                    current_day: currentDay,
                    last_activity_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            await supabase.from(READING_PLAN_TABLE).delete().eq('id', guest.id);
            merged++;
        } else {
            const { error: upErr } = await supabase
                .from(READING_PLAN_TABLE)
                .update({ user_id: newUserId })
                .eq('id', guest.id);
            if (!upErr) moved++;
        }
    }

    return { table: READING_PLAN_TABLE, success: true, moved, merged };
}

async function mergeTableIndividually(table, oldUserId, newUserId) {
    if (table === READING_PLAN_TABLE) {
        return mergeReadingPlans(oldUserId, newUserId);
    }

    const { data: rows, error: fetchErr } = await supabase.from(table).select('id').eq('user_id', oldUserId);
    if (fetchErr) {
        return { table, success: false, error: fetchErr.message };
    }

    let moved = 0;
    let dropped = 0;

    for (const row of rows || []) {
        const { error: upErr } = await supabase.from(table).update({ user_id: newUserId }).eq('id', row.id);

        if (!upErr) {
            moved++;
            continue;
        }

        if (upErr.code === '23505' || upErr.status === 409) {
            await supabase.from(table).delete().eq('id', row.id);
            dropped++;
        } else {
            console.warn(`[Migration] Row ${row.id} in ${table}:`, upErr.message);
            return { table, success: false, error: upErr.message };
        }
    }

    return { table, success: true, moved, dropped };
}

async function migrateTable(table, oldUserId, newUserId) {
    if (table === READING_PLAN_TABLE) {
        const { count, error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', oldUserId);

        if (error) {
            return { table, success: false, error: error.message };
        }
        if (!count) {
            return { table, success: true, count: 0 };
        }
        return mergeReadingPlans(oldUserId, newUserId);
    }

    const { error } = await supabase.from(table).update({ user_id: newUserId }).eq('user_id', oldUserId);

    if (!error) {
        return { table, success: true };
    }

    if (error.code === '23505' || error.status === 409) {
        console.log(`[Migration] Conflicts in ${table}, merging row-by-row...`);
        return mergeTableIndividually(table, oldUserId, newUserId);
    }

    return { table, success: false, error: error.message };
}

/**
 * Migrates all data from an anonymous ID to an authenticated ID.
 */
export const migrateAnonymousData = async (newUserId) => {
    const oldUserId = localStorage.getItem(GUEST_ID_KEY);

    if (!oldUserId || !newUserId || oldUserId === newUserId) {
        return { success: false, message: 'No valid IDs for migration', results: [] };
    }

    const needsMigration = await checkIfMigrationNeeded(oldUserId);
    if (!needsMigration) {
        console.log('[Migration] No guest data found; retiring guest id.');
        clearGuestIdAfterSuccess();
        clearMigrationState();
        return { success: true, message: 'No data to migrate', results: [] };
    }

    initMigrationState(oldUserId, newUserId);
    console.log(`[Migration] Starting ${oldUserId} → ${newUserId}`);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (email) {
            supabase
                .from('user_profiles')
                .upsert(
                    [{ user_id: newUserId, email, last_seen: new Date().toISOString() }],
                    { onConflict: 'user_id' }
                )
                .then(({ error }) => {
                    if (error) console.warn('[Migration] Profile link error:', error.message);
                });
        }
    } catch (e) {
        console.warn('[Migration] Failed to link profile', e);
    }

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Migration timed out')), MIGRATION_TIMEOUT_MS)
    );

    let results = [];
    try {
        const work = Promise.all(
            TABLES_TO_MIGRATE.map(async (table) => {
                const result = await migrateTable(table, oldUserId, newUserId);
                recordTableResult(table, result.success, result);
                return result;
            })
        );
        results = await Promise.race([work, timeoutPromise]);
    } catch (err) {
        console.error('[Migration] Interrupted:', err.message);
        results = TABLES_TO_MIGRATE.map((table) => {
            const cached = getMigrationState()?.tables?.[table];
            if (cached) {
                return { table, success: cached.ok, error: cached.error };
            }
            return { table, success: false, error: err.message };
        });
    }

    const allOk = results.length > 0 && results.every((r) => r.success);
    const anyOk = results.some((r) => r.success);

    if (allOk) {
        clearGuestIdAfterSuccess();
        console.log('[Migration] All tables OK');
    } else {
        console.warn('[Migration] Incomplete — guest id retained for retry');
    }

    return {
        success: allOk,
        partial: anyOk && !allOk,
        results,
        guestId: oldUserId,
    };
};

/**
 * True if any migrate-table has rows for this guest id.
 */
export const checkIfMigrationNeeded = async (oldUserId) => {
    if (!oldUserId) return false;

    try {
        const checks = await Promise.all(
            TABLES_TO_MIGRATE.map(async (table) => {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', oldUserId)
                    .limit(1);

                if (error) {
                    console.warn(`[Migration] Check ${table}:`, error.message);
                    return false;
                }
                return (count || 0) > 0;
            })
        );

        const needed = checks.some(Boolean);
        if (needed) {
            console.log('[Migration] Guest data found — migration needed.');
        }
        return needed;
    } catch (err) {
        console.warn('[Migration] checkIfMigrationNeeded error:', err);
        return true;
    }
};

export const hasPendingGuestMigration = async (authUserId) => {
    const guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId || guestId === authUserId) return false;
    return checkIfMigrationNeeded(guestId);
};
