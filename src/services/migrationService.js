import { supabase } from '../config/supabaseClient';
import {
    GUEST_ID_KEY,
    MIGRATION_STATE_KEY,
    TABLES_TO_MIGRATE,
    isGuestUserId,
    summarizeInspection,
} from '../utils/migrationHelpers';

export { TABLES_TO_MIGRATE, MIGRATION_STATE_KEY };

let migrationInFlight = null;

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

export function clearGuestIdAfterSuccess(expectedGuestId) {
    if (localStorage.getItem(GUEST_ID_KEY) !== expectedGuestId) return false;
    localStorage.removeItem(GUEST_ID_KEY);
    const state = getMigrationState();
    if (state) {
        state.completedAt = new Date().toISOString();
        saveMigrationState(state);
    }
    return true;
}

function recordInspection(guestId, authUserId, inspection) {
    saveMigrationState({
        guestId,
        authUserId,
        tables: inspection.tables,
        needed: inspection.needed,
        uncertain: inspection.uncertain,
        confirmedEmpty: inspection.confirmedEmpty,
        startedAt: new Date().toISOString(),
        completedAt: null,
    });
}

/**
 * Three-state inspect: found / empty / failed. Never treat errors as empty.
 */
export const inspectGuestMigration = async (oldUserId) => {
    if (!oldUserId) {
        return { needed: false, uncertain: false, confirmedEmpty: true, tables: {} };
    }

    const { data, error } = await supabase.rpc('inspect_guest_migration', {
        p_guest_id: oldUserId,
    });

    if (error) {
        console.warn('[Migration] inspect failed:', error.message);
        const tables = Object.fromEntries(
            TABLES_TO_MIGRATE.map((t) => [t, { status: 'failed', error: error.message }])
        );
        return {
            needed: false, uncertain: true, confirmedEmpty: false, tables, error: error.message,
        };
    }

    const tables = data || {};
    return { tables, ...summarizeInspection(tables) };
};

/** @deprecated use inspectGuestMigration — true only when data is found (not on errors). */
export const checkIfMigrationNeeded = async (oldUserId) => {
    const inspect = await inspectGuestMigration(oldUserId);
    return inspect.needed;
};

export const hasPendingGuestMigration = async (authUserId) => {
    const guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId || guestId === authUserId) return false;
    const inspect = await inspectGuestMigration(guestId);
    return inspect.needed || inspect.uncertain;
};

async function runMigration(newUserId) {
    const oldUserId = localStorage.getItem(GUEST_ID_KEY);

    if (!oldUserId || !newUserId || oldUserId === newUserId) {
        return { success: false, message: 'No valid IDs for migration', results: [] };
    }
    if (!isGuestUserId(oldUserId)) {
        console.warn('[Migration] Refusing non-guest id');
        return { success: false, message: 'invalid_guest_id', results: [] };
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || sessionData?.user?.id !== newUserId) {
        return { success: false, message: 'migration_account_changed', results: [] };
    }

    const inspection = await inspectGuestMigration(oldUserId);
    recordInspection(oldUserId, newUserId, inspection);

    if (inspection.uncertain) {
        return {
            success: false,
            uncertain: true,
            message: 'Could not confirm guest data. Guest id kept for retry.',
            results: Object.entries(inspection.tables).map(([table, info]) => ({
                table,
                success: false,
                error: info.error || 'inspect_failed',
            })),
            guestId: oldUserId,
        };
    }

    if (inspection.confirmedEmpty) {
        if (!clearGuestIdAfterSuccess(oldUserId)) {
            return { success: false, message: 'guest_identity_changed', results: [] };
        }
        clearMigrationState();
        return { success: true, message: 'No data to migrate', results: [] };
    }

    console.log(`[Migration] RPC ${oldUserId} → ${newUserId}`);

    const { data, error } = await supabase.rpc('migrate_guest_data', {
        p_guest_id: oldUserId,
    });

    if (error) {
        console.error('[Migration] RPC failed:', error.message);
        saveMigrationState({
            ...getMigrationState(),
            lastError: error.message,
            completedAt: null,
        });
        return {
            success: false,
            partial: false,
            message: error.message,
            results: [{ table: 'migrate_guest_data', success: false, error: error.message }],
            guestId: oldUserId,
        };
    }

    const verify = await inspectGuestMigration(oldUserId);
    const allGone = verify.confirmedEmpty;
    const verifyFailed = verify.uncertain;

    if (allGone && !verifyFailed) {
        if (!clearGuestIdAfterSuccess(oldUserId)) {
            return { success: false, message: 'guest_identity_changed', results: [] };
        }
        return { success: true, results: [{ table: 'all', success: true }], data, guestId: oldUserId };
    }

    return {
        success: false,
        partial: true,
        message: verifyFailed ? 'verify_failed' : 'remaining_guest_rows',
        results: Object.entries(verify.tables).map(([table, info]) => ({
            table,
            success: info.status === 'empty',
            error: info.status === 'empty' ? null : info.status,
        })),
        guestId: oldUserId,
    };
}

/**
 * Transfer guest rows to the signed-in user via server RPC (one transaction).
 * Overlapping calls share the same in-flight promise.
 */
export const migrateAnonymousData = async (newUserId) => {
    if (migrationInFlight) {
        if (migrationInFlight.userId !== newUserId) {
            return { success: false, message: 'migration_account_changed', results: [] };
        }
        return migrationInFlight.promise;
    }
    const promise = runMigration(newUserId).finally(() => {
        migrationInFlight = null;
    });
    migrationInFlight = { userId: newUserId, promise };
    return promise;
};
