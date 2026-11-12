import { describe, expect, it } from 'vitest';
import {
    classifyTableCheck,
    isGuestUserId,
    mergeConflictingText,
    mergeCompletedDays,
    mergeDayNotes,
    shouldRetireGuestId,
    summarizeInspection,
    GUEST_NOTE_SEPARATOR,
} from './migrationHelpers';
import { applyChapterLoadResult, isStaleChapterLoad, nextChapterLoadId } from './chapterLoadGuard';
import { isValidPlanDay, validCompletedDays } from './planDayValidation';
import { tryReserveUsage } from './aiUsageLimits';
import { canCompleteDeletion, isAuthUserAlreadyGone, isLeaseExpired } from './deletionJob';
import { fetchAllPages } from './fetchAllPages';

describe('guest migration helpers', () => {
    it('accepts only user_ guest ids, not auth UUIDs', () => {
        expect(isGuestUserId('user_abc123xyz')).toBe(true);
        expect(isGuestUserId('fikjnvkz-aaaa-bbbb-cccc-ddddeeeeffff')).toBe(false);
        expect(isGuestUserId('')).toBe(false);
    });

    it('treats inspect errors as failed, never empty', () => {
        expect(classifyTableCheck({ error: { message: 'timeout' }, count: 0 })).toEqual({
            status: 'failed',
            count: 0,
            error: 'timeout',
        });
        expect(classifyTableCheck({ error: null, count: 0 }).status).toBe('empty');
        expect(classifyTableCheck({ error: null, count: 2 }).status).toBe('found');
    });

    it('does not retire guest id when any table check failed', () => {
        const inspect = summarizeInspection({
            verse_notes: { status: 'failed', error: 'network' },
            verse_highlights: { status: 'empty', count: 0 },
        });
        expect(inspect.uncertain).toBe(true);
        expect(inspect.confirmedEmpty).toBe(false);
        expect(shouldRetireGuestId({ ...inspect, allTablesOk: false })).toBe(false);
    });

    it('preserves both note texts on conflict', () => {
        const merged = mergeConflictingText('Dest note', 'Guest note');
        expect(merged).toContain('Dest note');
        expect(merged).toContain('Guest note');
        expect(merged).toContain(GUEST_NOTE_SEPARATOR.trim());
    });

    it('merges plan days without dropping dest days', () => {
        expect(mergeCompletedDays([1, 2], [2, 3], 30)).toEqual([1, 2, 3]);
        expect(mergeCompletedDays([1], [99], 7)).toEqual([1]);
    });

    it('merges day notes without dropping dest text', () => {
        const notes = mergeDayNotes({ 1: 'A' }, { 1: 'B', 2: 'C' });
        expect(notes[1]).toContain('A');
        expect(notes[1]).toContain('B');
        expect(notes[2]).toBe('C');
    });
});

describe('chapter load generation guard', () => {
    it('drops an older delayed response for normal view', () => {
        const first = nextChapterLoadId(0);
        const second = nextChapterLoadId(first);
        expect(isStaleChapterLoad(first, second)).toBe(true);
        const applied = applyChapterLoadResult({
            loadId: first,
            currentLoadId: second,
            main: [{ verse: 1, text: 'old' }],
            secondary: [],
            split: false,
        });
        expect(applied.apply).toBe(false);
    });

    it('applies only the latest split-view pair', () => {
        const latest = 4;
        const stale = applyChapterLoadResult({
            loadId: 3,
            currentLoadId: latest,
            main: ['old-main'],
            secondary: ['old-sec'],
            split: true,
        });
        const fresh = applyChapterLoadResult({
            loadId: latest,
            currentLoadId: latest,
            main: ['new-main'],
            secondary: ['new-sec'],
            split: true,
        });
        expect(stale.apply).toBe(false);
        expect(fresh.apply).toBe(true);
        expect(fresh.verses).toEqual(['new-main']);
        expect(fresh.secondVerses).toEqual(['new-sec']);
    });
});

describe('plan day validation', () => {
    it('rejects days outside 1..duration', () => {
        expect(isValidPlanDay(0, 10)).toBe(false);
        expect(isValidPlanDay(11, 10)).toBe(false);
        expect(isValidPlanDay(10, 10)).toBe(true);
        expect(validCompletedDays([1, 11, 2], 10)).toEqual([1, 2]);
    });
});

describe('AI usage reservation', () => {
    it('blocks concurrent reservations past the limit', () => {
        let used = 49;
        const first = tryReserveUsage(used, 50);
        expect(first.ok).toBe(true);
        used = first.next;
        const second = tryReserveUsage(used, 50);
        expect(second.ok).toBe(false);
        expect(second.next).toBe(50);
    });
});

describe('deletion job completion', () => {
    it('does not complete when a table delete failed or rows remain', () => {
        expect(canCompleteDeletion({
            tableErrors: [{ table: 'verse_notes', error: 'fk' }],
            remainingCounts: { verse_notes: 0 },
            authDeleteError: null,
        })).toBe(false);
        expect(canCompleteDeletion({
            tableErrors: [],
            remainingCounts: { verse_notes: 2 },
            authDeleteError: null,
        })).toBe(false);
    });

    it('treats missing auth user as success and retries expired leases', () => {
        expect(isAuthUserAlreadyGone({ message: 'User not found' })).toBe(true);
        expect(canCompleteDeletion({
            tableErrors: [],
            remainingCounts: { verse_notes: 0 },
            authDeleteError: { message: 'User not found' },
        })).toBe(true);
        expect(isLeaseExpired({
            status: 'processing',
            lease_until: new Date(Date.now() - 1000).toISOString(),
        })).toBe(true);
        expect(isLeaseExpired({
            status: 'processing',
            lease_until: new Date(Date.now() + 60_000).toISOString(),
        })).toBe(false);
    });
});

describe('fetchAllPages', () => {
    it('walks until a short page using unique ordering', async () => {
        const pages = {
            '0-1': [{ id: 2 }, { id: 1 }],
            '2-3': [{ id: 0 }],
        };
        const rows = await fetchAllPages(async (from, to) => ({
            data: pages[`${from}-${to}`] || [],
            error: null,
        }), 2);
        expect(rows.map((r) => r.id)).toEqual([2, 1, 0]);
    });
});
