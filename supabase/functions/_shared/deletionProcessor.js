/** Shared by the deployed worker and regression tests. No Auth removal on failed cleanup. */
export function isAuthUserGone(error) {
    return error?.code === 'user_not_found'
        || /^user not found\.?$/i.test(String(error?.message || '').trim())
        || /already been deleted/i.test(String(error?.message || ''));
}

export async function processDeletionJob(client, row) {
    const job = { p_job_id: row.id, p_claimed_at: row.claimed_at };
    try {
        const purge = await client.rpc('purge_account_deletion_data', job);
        if (purge.error) throw purge.error;

        const renewed = await client.rpc('renew_account_deletion_lease', job);
        if (renewed.error) throw renewed.error;

        const auth = await client.auth.admin.deleteUser(row.user_id);
        if (auth.error && !isAuthUserGone(auth.error)) throw auth.error;

        // Catch writes made before Auth removal while the first purge was running.
        const finalPurge = await client.rpc('purge_account_deletion_data', job);
        if (finalPurge.error) throw finalPurge.error;
        const finished = await client.rpc('finish_account_deletion_job', { ...job, p_error: null });
        if (finished.error) throw finished.error;
        return { id: row.id, ok: true };
    } catch (error) {
        const message = String(error?.message || error);
        const retry = await client.rpc('finish_account_deletion_job', { ...job, p_error: message.slice(0, 2000) });
        return { id: row.id, ok: false, error: message, retryError: retry.error?.message || null };
    }
}
