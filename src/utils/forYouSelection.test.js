import { describe, expect, it } from 'vitest';
import { DEFAULT_TOPIC_IDS } from '../config/forYouTopics';
import { localDay, matchTopics, preferenceStates, rankInterests, planForYou, validateGeneratedPiece } from './forYouSelection';

const base = { userId: 'user-test', language: 'en', day: '2026-11-12', preferences: { topics: {} }, interests: [], history: [] };
describe('For You content planning', () => {
    it('produces a reflection and two genuinely different article formats deterministically', () => {
        const plan = planForYou(base);
        expect(plan[0].format_id).toBe('quiet_reflection');
        expect(new Set(plan.map(p => p.format_id)).size).toBe(3);
        expect(new Set(plan.map(p => p.passage_key)).size).toBe(3);
        expect(planForYou(base)).toEqual(plan);
    });
    it('honours exclusions across every slot including discovery', () => {
        const plan = planForYou({ ...base, preferences: { topics: { faith: 'exclude' } }, interests: [{ id: 'faith', score: 99 }, { id: 'love', score: 1 }] });
        expect(plan).toHaveLength(3);
        expect(plan.every(p => p.topic_id !== 'faith')).toBe(true);
    });
    it('does not resurrect fallback topics when all starting interests are excluded', () => {
        const preferences = { topics: Object.fromEntries(DEFAULT_TOPIC_IDS.map(id => [id, 'exclude'])) };
        expect(planForYou({ ...base, preferences })).toEqual([]);
    });
    it('uses a newly preferred topic immediately, without waiting for new searches', () => {
        const plan = planForYou({ ...base, preferences: { topics: { holy_spirit: 'prefer' } } });
        expect(plan[0].topic_id).toBe('holy_spirit');
        expect(plan[0].reason).toBe('chosen');
    });
    it('avoids reusing a single book passage when other eligible passages exist', () => {
        const plan = planForYou({ ...base, interests: [{ id: 'book_43', score: 5 }] });
        expect(new Set(plan.map(p => p.passage_key)).size).toBe(3);
    });
    it('rotates away from recent formats and does not permanently exhaust the catalogue', () => {
        const first = planForYou(base);
        const history = first.map(p => ({ ...p, generated_at: '2026-11-11T12:00:00Z' }));
        const second = planForYou({ ...base, history });
        const oldFormats = first.slice(1).map(p => p.format_id);
        expect(second.slice(1).every(p => !oldFormats.includes(p.format_id))).toBe(true);
    });
    it('keeps a single refreshed article different from the article left on screen', () => {
        const first = planForYou(base);
        const plan = planForYou({ ...base, lockedItems: [first[0], first[2]], refresh: 4 });
        expect(plan[1].format_id).not.toBe(first[2].format_id);
        expect(plan[1].passage_key).not.toBe(first[0].passage_key);
        expect(plan[1].passage_key).not.toBe(first[2].passage_key);
    });
    it('downranks a recently disliked format instead of permanently banning its topic', () => {
        const first = planForYou(base);
        const history = [{ ...first[1], less_like: true, generated_at: '2026-11-12T08:00:00Z' }];
        const second = planForYou({ ...base, history, refresh: 1 });
        expect(second.slice(1).every(p => p.format_id !== first[1].format_id)).toBe(true);
    });
    it('uses local midnight rather than the UTC calendar date', () => {
        expect(localDay(new Date('2026-11-11T22:30:00Z'), 'Africa/Johannesburg')).toBe('2026-11-12');
        expect(localDay(new Date('2026-11-11T22:30:00Z'), 'UTC')).toBe('2026-11-11');
    });
});

describe('For You interest matching and response validation', () => {
    it('matches bilingual phrases with word boundaries', () => {
        expect(matchTopics('Tell me about the Holy Spirit')).toContain('holy_spirit');
        expect(matchTopics('Wat beteken die Heilige Gees?')).toContain('holy_spirit');
        expect(matchTopics('unforgiven')).not.toContain('forgiveness');
        expect(matchTopics('John 3:16')).toContain('book_43');
    });
    it('keeps legacy exclusions across translated labels, with explicit new choices taking precedence', () => {
        expect(preferenceStates({ legacy: { highlighted: { Geloof: false } } }).faith).toBe('exclude');
        expect(preferenceStates({ legacy: { hidden: { Faith: true } }, topics: { faith: 'prefer' } }).faith).toBe('prefer');
    });
    it('caps repeated signals and gives recent activity more weight', () => {
        const now = Date.parse('2026-11-12T12:00:00Z');
        const events = Array.from({ length: 20 }, () => ({ query: 'faith faith faith', created_at: '2026-11-12T10:00:00Z' }));
        events.push({ query: 'hope', created_at: '2025-01-01T00:00:00Z' });
        const ranked = rankInterests(events, { topics: {} }, now);
        expect(ranked[0].id).toBe('faith');
        expect(ranked[0].score).toBeLessThanOrEqual(3);
        expect(rankInterests(events, { topics: { faith: 'exclude' } }, now).some(i => i.id === 'faith')).toBe(false);
    });
    it('rejects invalid provider output rather than treating it as content', () => {
        expect(() => validateGeneratedPiece('not json')).toThrow();
        expect(() => validateGeneratedPiece(JSON.stringify({ title: 'A title', summary: 'Brief', paragraphs: ['too short'] }))).toThrow();
    });
    it('splits a single string paragraph field into two paragraphs', () => {
        const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') + ' ' + Array.from({ length: 40 }, (_, i) => `extra${i}`).join(' ');
        const out = validateGeneratedPiece(JSON.stringify({
            title: 'A title', summary: 'Brief', paragraphs: words, closing: '',
        }));
        expect(out.paragraphs.length).toBe(2);
    });
    it('parses JSON with preamble and splits one block into paragraphs', () => {
        const body = {
            title: 'A title',
            summary: 'Brief summary',
            paragraphs: [
                Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') +
                '\n\n' +
                Array.from({ length: 40 }, (_, i) => `more${i}`).join(' '),
            ],
            closing: '',
        };
        const wrapped = `Here is the JSON:\n${JSON.stringify(body)}`;
        const out = validateGeneratedPiece(wrapped);
        expect(out.paragraphs.length).toBe(2);
    });
});
