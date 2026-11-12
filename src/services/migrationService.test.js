import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLES_TO_MIGRATE } from '../utils/migrationHelpers';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('../config/supabaseClient', () => ({ supabase: { rpc: mock.rpc, auth: { getUser: mock.getUser } } }));
import { migrateAnonymousData } from './migrationService';

const guest = 'user_legacytest123';
const account = 'account-test';
const empty = () => Object.fromEntries(TABLES_TO_MIGRATE.map(t => [t, { status: 'empty', count: 0 }]));
const found = () => ({ ...empty(), verse_notes: { status: 'found', count: 1 } });

beforeEach(() => {
    vi.clearAllMocks();
    const data = new Map([['bible_user_id', guest]]);
    vi.stubGlobal('localStorage', {
        getItem: k => data.get(k) ?? null,
        setItem: (k, v) => data.set(k, v),
        removeItem: k => data.delete(k),
    });
    mock.getUser.mockResolvedValue({ data: { user: { id: account } }, error: null });
});

describe('migration orchestration with real service code', () => {
    it('keeps the guest identity on failed inspection without trying to migrate', async () => {
        mock.rpc.mockResolvedValue({ data: null, error: { message: 'network unavailable' } });
        const result = await migrateAnonymousData(account);
        expect(result.success).toBe(false);
        expect(localStorage.getItem('bible_user_id')).toBe(guest);
        expect(mock.rpc.mock.calls.map(c => c[0])).toEqual(['inspect_guest_migration']);
    });
    it('requires support verification and retains the identity for an unapproved guest', async () => {
        mock.rpc.mockResolvedValue({ error: { message: 'guest_ownership_verification_required' } });
        const result = await migrateAnonymousData(account);
        expect(result.requiresVerification).toBe(true);
        expect(localStorage.getItem('bible_user_id')).toBe(guest);
    });
    it('does not retire the id on an incomplete inspection response', async () => {
        mock.rpc.mockResolvedValue({ data: { verse_notes: { status: 'empty', count: 0 } }, error: null });
        const result = await migrateAnonymousData(account);
        expect(result.uncertain).toBe(true);
        expect(localStorage.getItem('bible_user_id')).toBe(guest);
    });
    it('retains the id after a failed transactional merge', async () => {
        mock.rpc.mockResolvedValueOnce({ data: found() })
            .mockResolvedValueOnce({ error: { message: 'foreign key violation' } });
        const result = await migrateAnonymousData(account);
        expect(result.success).toBe(false);
        expect(localStorage.getItem('bible_user_id')).toBe(guest);
    });
    it('retains the id when post-migration verification fails', async () => {
        mock.rpc.mockResolvedValueOnce({ data: found() })
            .mockResolvedValueOnce({ data: { success: true } })
            .mockResolvedValueOnce({ error: { message: 'timeout' } });
        expect((await migrateAnonymousData(account)).success).toBe(false);
        expect(localStorage.getItem('bible_user_id')).toBe(guest);
    });
    it('clears only after full inspection, migration and empty verification', async () => {
        mock.rpc.mockResolvedValueOnce({ data: found() })
            .mockResolvedValueOnce({ data: { success: true } })
            .mockResolvedValueOnce({ data: empty() });
        expect((await migrateAnonymousData(account)).success).toBe(true);
        expect(localStorage.getItem('bible_user_id')).toBeNull();
    });
    it('never clears a new guest identity created during an old transfer', async () => {
        mock.rpc.mockResolvedValueOnce({ data: found() })
            .mockResolvedValueOnce({ data: { success: true } })
            .mockImplementationOnce(async () => {
                localStorage.setItem('bible_user_id', 'user_newidentity');
                return { data: empty() };
            });
        expect((await migrateAnonymousData(account)).success).toBe(false);
        expect(localStorage.getItem('bible_user_id')).toBe('user_newidentity');
    });
    it('rejects a transfer for a different signed-in account', async () => {
        mock.getUser.mockResolvedValue({ data: { user: { id: 'other-account' } } });
        expect((await migrateAnonymousData(account)).message).toBe('migration_account_changed');
        expect(mock.rpc).not.toHaveBeenCalled();
    });
    it('shares same-account work but rejects an overlapping different-account request', async () => {
        let release;
        mock.rpc.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const first = migrateAnonymousData(account);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        const second = migrateAnonymousData(account);
        const other = await migrateAnonymousData('other-account');
        expect(other.message).toBe('migration_account_changed');
        release({ data: empty() });
        expect((await first).success).toBe(true);
        expect((await second).success).toBe(true);
        expect(mock.rpc).toHaveBeenCalledTimes(1);
    });
});
