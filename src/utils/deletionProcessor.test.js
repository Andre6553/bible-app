import { describe, expect, it, vi } from 'vitest';
import { processDeletionJob, isAuthUserGone } from '../../supabase/functions/_shared/deletionProcessor.js';

const row = { id: 'job-id', user_id: 'user-id', claimed_at: '2026-11-12T08:00:00Z' };
const client = () => ({ rpc: vi.fn().mockResolvedValue({ error: null }), auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } } });

describe('actual deletion processor', () => {
    it('never deletes Auth or completes a job after relational cleanup fails', async () => {
        const c = client();
        c.rpc.mockResolvedValueOnce({ error: { code: '42703', message: 'column does not exist' } });
        const result = await processDeletionJob(c, row);
        expect(result.ok).toBe(false);
        expect(c.auth.admin.deleteUser).not.toHaveBeenCalled();
        expect(c.rpc).toHaveBeenLastCalledWith('finish_account_deletion_job', expect.objectContaining({ p_error: 'column does not exist' }));
    });
    it('stops before Auth removal if its claim lease was lost', async () => {
        const c = client();
        c.rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'deletion_lease_lost' } });
        expect((await processDeletionJob(c, row)).ok).toBe(false);
        expect(c.auth.admin.deleteUser).not.toHaveBeenCalled();
    });
    it('purges again after Auth deletion before marking the job complete', async () => {
        const c = client();
        expect((await processDeletionJob(c, row)).ok).toBe(true);
        expect(c.rpc.mock.calls.map(c => c[0])).toEqual([
            'purge_account_deletion_data', 'renew_account_deletion_lease',
            'purge_account_deletion_data', 'finish_account_deletion_job',
        ]);
        expect(c.rpc).toHaveBeenLastCalledWith('finish_account_deletion_job', { p_job_id: row.id, p_claimed_at: row.claimed_at, p_error: null });
    });
    it('retries safely when Auth is already gone', async () => {
        const c = client();
        c.auth.admin.deleteUser.mockResolvedValue({ error: { code: 'user_not_found' } });
        expect((await processDeletionJob(c, row)).ok).toBe(true);
    });
    it('does not treat a generic 404 or unrelated missing object as a deleted user', () => {
        expect(isAuthUserGone({ status: 404, message: 'endpoint not found' })).toBe(false);
        expect(isAuthUserGone({ message: 'table not found' })).toBe(false);
    });
    it('does not complete after a post-Auth cleanup failure', async () => {
        const c = client();
        c.rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({ error: { message: 'remaining_user_rows:verse_notes' } });
        expect((await processDeletionJob(c, row)).ok).toBe(false);
        expect(c.rpc.mock.calls.filter(([name, args]) => name === 'finish_account_deletion_job' && args.p_error === null)).toHaveLength(0);
    });
    it('reports a failure to persist retry status instead of claiming success', async () => {
        const c = client();
        c.rpc.mockResolvedValue({ error: { message: 'database unavailable' } });
        const result = await processDeletionJob(c, row);
        expect(result.ok).toBe(false);
        expect(result.retryError).toBe('database unavailable');
    });
});
