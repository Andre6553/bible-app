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

    console.log(`[Migration] 🔄 Starting migration from ${oldUserId} to ${newUserId}`);

    // Link the old guest ID to the new user email in the background
    // This allows the stats page to group historical data even if migration fails for some tables
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (email) {
            console.log(`[Migration] 🔗 Linking guest ${oldUserId} to ${email}`);
            supabase.from('user_profiles').upsert([
                { user_id: oldUserId, email: email },
                { user_id: newUserId, email: email }
            ]).then(({ error }) => {
                if (error) console.warn('[Migration] Profile link error:', error.message);
            });
        }
    } catch (e) {
        console.warn('[Migration] Failed to link profile', e);
    }

    const results = [];

    for (const table of TABLES_TO_MIGRATE) {
        try {
            const { count, error } = await supabase
                .from(table)
                .update({ user_id: newUserId })
                .eq('user_id', oldUserId);

            if (error) {
                console.warn(`[Migration] ⚠️ Failed for table ${table}:`, error.message, error.details);
                results.push({ table, success: false, error: error.message, details: error.details });
            } else {
                console.log(`[Migration] ✅ Table ${table}: Migrated ${count || 0} records`);
                results.push({ table, success: true, count: count || 0 });
            }
        } catch (err) {
            console.error(`[Migration] ❌ Error in table ${table}:`, err);
            results.push({ table, success: false, error: err.message });
        }
    }

    // Clear the old user ID from localStorage as it's no longer needed
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0) {
        console.log(`[Migration] 🏁 Completed. ${successCount}/${TABLES_TO_MIGRATE.length} tables processed. Retiring guest ID.`);
        localStorage.removeItem('bible_user_id');
    } else {
        console.log(`[Migration] 🏁 Completed. No records found to move.`);
        localStorage.removeItem('bible_user_id'); // Also remove if nothing found to prevent re-checks
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
