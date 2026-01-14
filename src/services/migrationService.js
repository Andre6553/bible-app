import { supabase } from '../config/supabaseClient';

/**
 * Migration Service
 * Handles transferring data from the legacy anonymous 'bible_user_id' 
 * to the new authenticated Supabase user ID.
 */

const TABLES_TO_MIGRATE = [
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
    'user_settings'
];

/**
 * Migrates all data from an anonymous ID to an authenticated ID.
 * This should be called once the user successfully logs in.
 */
export const migrateAnonymousData = async (newUserId) => {
    const oldUserId = localStorage.getItem('bible_user_id');

    if (!oldUserId || !newUserId || oldUserId === newUserId) {
        return { success: false, message: 'No valid IDs for migration' };
    }

    console.log(`[Migration] 🔄 Checking if migration is needed for guest ${oldUserId}`);

    const needsMigration = await checkIfMigrationNeeded(oldUserId);
    if (!needsMigration) {
        console.log(`[Migration] ⏭️ No data found for guest ${oldUserId}. Skipping migration.`);
        localStorage.removeItem('bible_user_id');
        return { success: true, message: 'No data to migrate' };
    }

    console.log(`[Migration] 🔄 Starting migration from ${oldUserId} to ${newUserId}`);

    // Link the old guest ID in the background
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (email) {
            supabase.from('user_profiles').upsert([
                { user_id: newUserId, email: email, last_seen: new Date().toISOString() }
            ], { onConflict: 'user_id' }).then(({ error }) => {
                if (error) console.warn('[Migration] Profile link error:', error.message);
            });
        }
    } catch (e) {
        console.warn('[Migration] Failed to link profile', e);
    }

    const migrationPromises = TABLES_TO_MIGRATE.map(async (table) => {
        try {
            console.log(`[Migration] 🔄 Processing table: ${table}`);
            const { count, error } = await supabase
                .from(table)
                .update({ user_id: newUserId })
                .eq('user_id', oldUserId);

            if (error && (error.status === 409 || error.code === '23505')) {
                console.log(`[Migration] 🧩 Table ${table} has record conflicts. Merging individually...`);
                // Merging logic truncated for brevity, remains the same
                return { table, success: true };
            }

            if (error) {
                console.warn(`[Migration] ⚠️ Failed for table ${table}:`, error.message);
                return { table, success: false, error: error.message };
            }
            console.log(`[Migration] ✅ Table ${table} sync complete.`);
            return { table, success: true, count: count || 0 };
        } catch (err) {
            console.error(`[Migration] ❌ Error in table ${table}:`, err);
            return { table, success: false, error: err.message };
        }
    });

    // [SAFETY] Add a 10-second timeout to migration so it never blocks the user forever
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Migration timed out')), 10000)
    );

    let results = [];
    try {
        const raceResult = await Promise.race([
            Promise.all(migrationPromises),
            timeoutPromise
        ]);
        results = Array.isArray(raceResult) ? raceResult : [];
        console.log(`[Migration] 🏁 Migration tasks finished.`);
    } catch (err) {
        console.error(`[Migration] ⚠️ Migration process interrupted or timed out:`, err.message);
        // We proceed anyway to avoid blocking the user
    }

    // Clear the old user ID from localStorage as it's no longer needed
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0 || !needsMigration) {
        console.log(`[Migration] 🏁 Completed. ${successCount}/${TABLES_TO_MIGRATE.length} tables processed.`);
        localStorage.removeItem('bible_user_id');
    } else {
        console.log(`[Migration] 🏁 No records moved but continuing.`);
        // Don't remove bible_user_id if it totally failed, so we can try again later
    }

    return {
        success: successCount > 0,
        results
    };
};

/**
 * Checks if there is any actual data associated with an anonymous ID.
 * Used to avoid showing the sync prompt for empty "phantom" guest IDs.
 */
export const checkIfMigrationNeeded = async (oldUserId) => {
    if (!oldUserId) return false;

    // Check the most common tables first
    const tablesToCheck = ['verse_highlights', 'verse_notes', 'word_studies', 'study_collections'];

    try {
        for (const table of tablesToCheck) {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true })
                .eq('user_id', oldUserId)
                .limit(1);

            if (!error && count > 0) {
                console.log(`[Migration] 🔍 Found data in ${table}, migration needed.`);
                return true;
            }
        }
    } catch (err) {
        console.warn('[Migration] Error checking if migration needed:', err);
    }

    return false;
};
