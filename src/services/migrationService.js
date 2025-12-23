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
    'devotional_history'
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

    const results = [];

    for (const table of TABLES_TO_MIGRATE) {
        try {
            const { count, error } = await supabase
                .from(table)
                .update({ user_id: newUserId })
                .eq('user_id', oldUserId);

            if (error) {
                console.warn(`[Migration] ⚠️ Failed for table ${table}:`, error.message);
                results.push({ table, success: false, error: error.message });
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
    // (We actually keep it until migration is confirmed successful or user logs out)
    const successCount = results.filter(r => r.success).length;
    console.log(`[Migration] 🏁 Completed. ${successCount}/${TABLES_TO_MIGRATE.length} tables processed.`);

    return {
        success: successCount > 0,
        results
    };
};
