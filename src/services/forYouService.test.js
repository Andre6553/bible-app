import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getUser: vi.fn(), generate: vi.fn() }));
vi.mock('../config/supabaseClient', () => ({ supabase: { rpc: mock.rpc, from: mock.from, auth: { getUser: mock.getUser } } }));
vi.mock('./bibleService', () => ({ getBooks: vi.fn() }));
vi.mock('./readingPlanService', () => ({ getActivePlan: vi.fn() }));
vi.mock('./blogService', () => ({ generateBlogAiText: mock.generate, getAiModelLabel: () => 'fixture-model', isRateLimitEnabled: vi.fn().mockResolvedValue(false) }));
vi.mock('./adminService', () => ({ logApiCall: vi.fn() }));
import { getForYouPiece, buildForYouPrompt, patchForYouInterest } from './forYouService';

const ctx = () => ({ userId: 'account', language: 'en', zone: 'Africa/Johannesburg', day: '2026-11-12', guest: false,
    prefs: { preferences: { topics: {} }, version: 1 }, interests: [], history: [], feedback: {},
    books: { all: [{ id: 99, order: 43, name_full: 'John' }] }, offline: false });
const spec = () => ({ slot: 'article_1', topic_id: 'faith', format_id: 'passage_explainer', ending: 'insight', language: 'en',
    day: '2026-11-12', passage: { book: 43, chapter: 3, start: 1, end: 2 }, prompt_version: 'for-you-v2' });
const content = () => ({ id: 'old', ...spec(), passage: { book_id: 99, chapter: 3, start: 1, end: 2, verses: [{ verse: 1, text: 'Verified text' }] },
    title: 'Existing reading', paragraphs: ['Existing text'], generated_at: '2026-11-12T08:00:00Z' });

beforeEach(() => {
    vi.clearAllMocks();
    const data = new Map();
    vi.stubGlobal('localStorage', { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) });
    mock.getUser.mockResolvedValue({ data: { user: { id: 'account' } } });
    mock.from.mockImplementation(() => {
        const q = { select: () => q, eq: () => q, order: () => Promise.resolve({ data: [{ verse: 1, text: 'Verified verse one' }, { verse: 2, text: 'Verified verse two' }] }) };
        return q;
    });
    mock.generate.mockResolvedValue(JSON.stringify({ title: 'Understanding this passage', summary: 'A closer look at the text.',
        paragraphs: [Array(45).fill('Observation').join(' '), Array(45).fill('Explanation').join(' ')], closing: 'A concise insight.' }));
    mock.rpc.mockImplementation(async (name, args) => {
        if (name === 'for_you_claim_content') return { data: { status: 'claimed', token: 'token', day: '2026-11-12' } };
        if (name === 'for_you_complete_content') return { data: { id: 'new', generated_at: '2026-11-12T09:00:00Z', payload: args.p_payload } };
        return { data: null };
    });
});

describe('actual For You generation orchestration', () => {
    it('does not call AI or read Scripture on a cloud cache hit', async () => {
        mock.rpc.mockResolvedValue({ data: { status: 'cached', content: { id: 'cache', payload: content() } } });
        expect((await getForYouPiece(ctx(), spec())).status).toBe('cached');
        expect(mock.generate).not.toHaveBeenCalled();
        expect(mock.from).not.toHaveBeenCalled();
    });
    it('uses one provider call for title/body, supplies real verses, and persists once', async () => {
        const result = await getForYouPiece(ctx(), spec());
        expect(result.status).toBe('generated');
        expect(mock.generate).toHaveBeenCalledTimes(1);
        expect(mock.generate.mock.calls[0][0]).toContain('Verified verse one');
        expect(result.content.passage.version).toBe('KJV');
        expect(result.content.passage.book_id).toBe(99);
        expect(mock.rpc.mock.calls.filter(([name]) => name === 'for_you_complete_content')).toHaveLength(1);
    });
    it('never generates paid content merely because a cache claim query failed', async () => {
        mock.rpc.mockResolvedValue({ error: { message: 'database unavailable' } });
        const result = await getForYouPiece(ctx(), spec());
        expect(result.status).toBe('error');
        expect(mock.generate).not.toHaveBeenCalled();
    });
    it('keeps previous content and releases the lease when provider generation fails', async () => {
        const context = ctx(); context.history = [content()];
        mock.generate.mockRejectedValue(new Error('provider unavailable'));
        const result = await getForYouPiece(context, spec(), { force: true });
        expect(result.status).toBe('error');
        expect(result.content.id).toBe('old');
        expect(mock.rpc).toHaveBeenCalledWith('for_you_release_content', { p_token: 'token' });
    });
    it('does not show an excluded topic as a failure fallback', async () => {
        const context = ctx(); context.history = [content()]; context.prefs.preferences.topics.faith = 'exclude';
        mock.generate.mockRejectedValue(new Error('provider unavailable'));
        expect((await getForYouPiece(context, spec())).content).toBeNull();
    });
    it('shares an overlapping in-flight generation instead of making two provider calls', async () => {
        const results = await Promise.all([getForYouPiece(ctx(), spec()), getForYouPiece(ctx(), spec())]);
        expect(results.every(r => r.status === 'generated')).toBe(true);
        expect(mock.generate).toHaveBeenCalledTimes(1);
    });
    it('rejects an account switch before generating or persisting content', async () => {
        mock.getUser.mockResolvedValue({ data: { user: { id: 'someone-else' } } });
        expect((await getForYouPiece(ctx(), spec())).status).toBe('error');
        expect(mock.rpc).not.toHaveBeenCalled();
        expect(mock.generate).not.toHaveBeenCalled();
    });
    it('does not generate when another tab already owns the slot', async () => {
        mock.rpc.mockResolvedValue({ data: { status: 'busy', content: null } });
        expect((await getForYouPiece(ctx(), spec())).status).toBe('busy');
        expect(mock.generate).not.toHaveBeenCalled();
    });
    it('handles a SQL composite with null fields as no cached content, not an article', async () => {
        mock.rpc.mockResolvedValue({ data: { status: 'busy', content: { id: null, payload: null } } });
        const result = await getForYouPiece(ctx(), spec());
        expect(result.status).toBe('busy'); expect(result.content).toBeNull();
    });
    it('accepts composite RPC rows returned as a one-element array', async () => {
        mock.rpc.mockResolvedValue({ data: [{ version: 2, preferences: { topics: { faith: 'exclude' } } }] });
        expect((await patchForYouInterest(ctx(), 'faith', 'exclude')).version).toBe(2);
    });
    it('repairs invalid JSON once without a separate title request', async () => {
        mock.generate.mockResolvedValueOnce('not-json');
        expect((await getForYouPiece(ctx(), spec())).status).toBe('generated');
        expect(mock.generate).toHaveBeenCalledTimes(2);
    });
    it('does not persist an additional unverified Scripture citation', async () => {
        mock.generate.mockResolvedValue(JSON.stringify({ title: 'A title', summary: 'Brief',
            paragraphs: [Array(45).fill('Observation').join(' '), 'John 99:99 ' + Array(45).fill('Explanation').join(' ')], closing: '' }));
        expect((await getForYouPiece(ctx(), spec())).status).toBe('error');
        expect(mock.generate).toHaveBeenCalledTimes(2);
        expect(mock.rpc.mock.calls.some(([name]) => name === 'for_you_complete_content')).toBe(false);
    });
    it('keeps previously cached content when the save fails', async () => {
        const context = ctx(); context.history = [content()];
        const original = mock.rpc.getMockImplementation();
        mock.rpc.mockImplementation((name, args) => name === 'for_you_complete_content'
            ? Promise.resolve({ error: { message: 'disk failure' } }) : original(name, args));
        const result = await getForYouPiece(context, spec(), { force: true });
        expect(result.status).toBe('error'); expect(result.content.id).toBe('old');
    });
    it('propagates preference-write errors so the page can roll back', async () => {
        mock.rpc.mockResolvedValue({ error: { message: 'preferences_changed_reload' } });
        await expect(patchForYouInterest(ctx(), 'faith', 'exclude')).rejects.toThrow('preferences_changed_reload');
    });
    it('uses format-specific instructions rather than a universal encouragement template', () => {
        const prompt = buildForYouPrompt(spec(), { reference: 'John 3:1–2', version: 'KJV', verses: [], context: 'Context' }, []);
        expect(prompt).toContain('No prayer, motivational pep talk');
        expect(prompt).toContain('Do not invent historical facts');
    });
});
