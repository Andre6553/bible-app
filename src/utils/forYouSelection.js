import { DEFAULT_TOPIC_IDS, FOR_YOU_TOPICS, TOPIC_BY_ID } from '../config/forYouTopics';
import { FOR_YOU_FORMATS, FOR_YOU_VERSION } from '../config/forYouFormats';

export function stableHash(value) {
    let hash = 2166136261;
    for (const c of String(value)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return hash >>> 0;
}

export function localDay(now = new Date(), timezone = 'Africa/Johannesburg') {
    const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

const normalise = text => String(text || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export function matchTopics(text) {
    const haystack = ` ${normalise(text)} `;
    return FOR_YOU_TOPICS.filter(t => t.aliases.some(alias => haystack.includes(` ${normalise(alias)} `))).map(t => t.id);
}

export function preferenceStates(preferences = {}) {
    const states = {};
    const legacy = preferences.legacy || {};
    for (const [word, enabled] of Object.entries(legacy.highlighted || {})) {
        for (const id of matchTopics(word)) states[id] = enabled === false ? 'exclude' : 'prefer';
    }
    for (const [word, hidden] of Object.entries(legacy.hidden || {})) {
        if (hidden) for (const id of matchTopics(word)) states[id] = 'exclude';
    }
    return { ...states, ...(preferences.topics || {}) };
}

export function rankInterests(events, preferences, now = Date.now()) {
    const states = preferenceStates(preferences);
    const scores = {};
    const perDay = new Map();
    for (const event of events) {
        const timestamp = Date.parse(event.created_at);
        if (!Number.isFinite(timestamp)) continue;
        const age = Math.max(0, (now - timestamp) / 86400000);
        const day = event.created_at.slice(0, 10);
        for (const id of matchTopics(event.query || event.question)) {
            const key = `${id}:${day}`;
            const count = perDay.get(key) || 0;
            if (count >= 3) continue;
            perDay.set(key, count + 1);
            scores[id] = (scores[id] || 0) + Math.exp(-age / 14);
        }
    }
    for (const [id, state] of Object.entries(states)) {
        if (state === 'prefer' && TOPIC_BY_ID[id]) scores[id] = (scores[id] || 0) + 5;
    }
    return Object.entries(scores).filter(([id]) => states[id] !== 'exclude')
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([id, score]) => ({ id, score, explicit: states[id] === 'prefer' }));
}

export const passageKey = p => `${p.book}:${p.chapter}:${p.start}-${p.end}`;

/** Plan every slot together, with deterministic diversity and true recency. */
export function planForYou({ userId, language, day, preferences, interests, history = [], refresh = 0, lockedItems = [] }) {
    const states = preferenceStates(preferences);
    const explicitPreferred = Object.keys(states).filter(id => states[id] === 'prefer' && TOPIC_BY_ID[id]);
    const allDisabled = DEFAULT_TOPIC_IDS.every(id => states[id] === 'exclude')
        && interests.length === 0 && explicitPreferred.length === 0;
    if (allDisabled) return [];
    const preferred = [...new Set([...explicitPreferred, ...interests.map(t => t.id)])].filter(id => TOPIC_BY_ID[id] && states[id] !== 'exclude');
    const discovery = DEFAULT_TOPIC_IDS.filter(id => states[id] !== 'exclude');
    const eligible = [...new Set([...preferred, ...discovery])];
    if (!eligible.length) return [];
    const recent = history.slice(0, 30);
    const seed = `${userId}:${language}:${day}:${refresh}`;
    const usedPassages = new Set(lockedItems.map(item => item.passage_key));
    const usedFormats = new Set(['quiet_reflection', ...lockedItems.map(item => item.format_id)]);
    const lastTopic = id => Math.max(0, ...recent.filter(h => h.topic_id === id).map(h => Date.parse(h.generated_at) || 0));
    const disliked = recent.filter(h => h.less_like && Date.parse(h.generated_at) >= Date.parse(`${day}T00:00:00Z`) - 14 * 86400000);
    const sortTopics = ids => [...ids].sort((a, b) => Number(disliked.some(h => h.topic_id === a)) - Number(disliked.some(h => h.topic_id === b))
        || lastTopic(a) - lastTopic(b) || stableHash(seed + a) - stableHash(seed + b));
    const ranked = sortTopics(preferred.length ? preferred.slice(0, 6) : eligible);
    const slots = ['devotional', 'article_1', 'article_2'];
    return slots.map((slot, index) => {
        const locked = lockedItems.find(item => item.slot === slot);
        if (locked) return locked;
        const pool = index === 2 && discovery.length > 0 ? sortTopics(discovery) : ranked;
        let topicId = pool[index % pool.length];
        if (TOPIC_BY_ID[topicId].passages.every(p => usedPassages.has(passageKey(p)))) {
            topicId = [...ranked, ...eligible].find(id => TOPIC_BY_ID[id].passages.some(p => !usedPassages.has(passageKey(p)))) || topicId;
        }
        let passages = [...TOPIC_BY_ID[topicId].passages].sort((a, b) => {
            const seen = p => recent.findIndex(h => h.passage_key === passageKey(p));
            const rank = p => seen(p) < 0 ? -1000 : -seen(p);
            return Number(usedPassages.has(passageKey(a))) - Number(usedPassages.has(passageKey(b)))
                || rank(a) - rank(b) || stableHash(seed + passageKey(a)) - stableHash(seed + passageKey(b));
        });
        const formatIds = Object.keys(FOR_YOU_FORMATS).filter(id => id !== 'quiet_reflection' && !usedFormats.has(id)
            && (!FOR_YOU_FORMATS[id].narrative || passages.some(p => p.person)));
        formatIds.sort((a, b) => {
            const seen = id => recent.slice(0, 6).filter(h => h.format_id === id).length + 10 * disliked.filter(h => h.format_id === id).length;
            return seen(a) - seen(b) || stableHash(seed + slot + a) - stableHash(seed + slot + b);
        });
        const formatId = index === 0 ? 'quiet_reflection' : formatIds[0];
        if (FOR_YOU_FORMATS[formatId].narrative) passages = passages.filter(p => p.person);
        const passage = passages.find(p => !usedPassages.has(passageKey(p))) || passages[0];
        usedPassages.add(passageKey(passage));
        usedFormats.add(formatId);
        const endings = FOR_YOU_FORMATS[formatId].endings;
        return {
            slot, topic_id: topicId, format_id: formatId, passage,
            passage_key: passageKey(passage), ending: endings[stableHash(seed + slot) % endings.length],
            reason: preferred.includes(topicId) ? (states[topicId] === 'prefer' ? 'chosen' : 'explored') : preferred.length ? 'discover' : 'general',
            language, day, prompt_version: FOR_YOU_VERSION,
        };
    });
}

export function parseForYouJson(raw) {
    const stripped = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const candidates = [stripped];
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) candidates.push(stripped.slice(start, end + 1));
    let lastError;
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            lastError = error;
        }
    }
    if (lastError instanceof SyntaxError) throw lastError;
    throw new SyntaxError(lastError?.message || 'invalid_json');
}

function normalizeParagraphs(paragraphs) {
    if (!Array.isArray(paragraphs)) return paragraphs;
    let list = paragraphs.filter(p => typeof p === 'string').map(p => p.trim()).filter(Boolean);
    if (list.length === 1) {
        const split = list[0].split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
        if (split.length >= 2) list = split;
    }
    return list;
}

export function validateGeneratedPiece(raw) {
    const data = parseForYouJson(raw);
    if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 150) throw new Error('invalid_title');
    if (typeof data.summary !== 'string' || data.summary.length > 500) throw new Error('invalid_summary');
    const paragraphs = normalizeParagraphs(data.paragraphs);
    if (!paragraphs || paragraphs.length < 2 || paragraphs.length > 9
        || paragraphs.some(p => typeof p !== 'string' || !p.trim() || p.length > 4000)) throw new Error('invalid_paragraphs');
    if (paragraphs.join(' ').split(/\s+/).length < 70 || paragraphs.join(' ').length > 12000) throw new Error('invalid_length');
    if (data.closing != null && (typeof data.closing !== 'string' || data.closing.length > 1500)) throw new Error('invalid_closing');
    return { title: data.title.trim(), summary: data.summary.trim(), paragraphs, closing: data.closing?.trim() || '' };
}
