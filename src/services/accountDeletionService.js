import { supabase } from '../config/supabaseClient';

/**
 * Queue account deletion (7-day grace). Requires active session.
 */
export async function requestAccountDeletion() {
    const { data, error } = await supabase.functions.invoke('request-account-deletion');

    if (error) {
        return { success: false, error: error.message };
    }

    if (!data?.success) {
        return { success: false, error: data?.error || 'request_failed' };
    }

    return {
        success: true,
        executeAfter: data.execute_after,
        alreadyRequested: !!data.already_requested,
        graceDays: data.grace_days ?? 7,
    };
}
