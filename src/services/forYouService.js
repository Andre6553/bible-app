import { supabase } from '../config/supabaseClient';
import { getBooks } from './bibleService';
import { getActivePlan } from './readingPlanService';
import { generateForYouAiText, getAiModelLabel, isRateLimitEnabled } from './blogService';
import { logApiCall } from './adminService';
import { resolveDbBook, getCanonicalBookMeta } from '../constants/canonicalBooks';
import { FOR_YOU_FORMATS, FOR_YOU_VERSION } from '../config/forYouFormats';
import { topicLabel } from '../config/forYouTopics';
import { localDay, preferenceStates, rankInterests, planForYou, stableHash, validateGeneratedPiece, matchTopics } from '../utils/forYouSelection';

const pending = new Map();
const timezone = () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.includes('/') ? zone : 'Africa/Johannesburg';
};
const sameDay = (left, right) => String(left || '').slice(0, 10) === String(right || '').slice(0, 10);
const guest = id => id.startsWith('user_');
const key = (id, name) => `omni_for_you_v2:${id}:${name}`;
function readLocal(id, name, fallback) {
    try { return JSON.parse(localStorage.getItem(key(id, name))) ?? fallback; } catch { return fallback; }
}
function writeLocal(id, name, data) {
    localStorage.setItem(key(id, name), JSON.stringify(data));
}
const payloadOf = row => {
    const value = row?.payload;
    if (!row?.id || typeof value?.title !== 'string' || !Array.isArray(value.paragraphs)
        || !value.paragraphs.every(p => typeof p === 'string') || !Array.isArray(value.passage?.verses)) return null;
    return { ...value, id: row.id, generated_at: row.generated_at };
};

async function rpc(name, args = {}) {
    const result = await supabase.rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    const composite = ['for_you_get_preferences', 'for_you_patch_preferences', 'for_you_complete_content', 'for_you_set_feedback'].includes(name);
    const data = composite && Array.isArray(result.data) ? result.data[0] : result.data;
    if (composite && !data) throw new Error('empty_rpc_result');
    return data;
}

async function assertAccount(ctx) {
    if (ctx.guest) return;
    const result = await supabase.auth.getUser();
    if (result.error || result.data?.user?.id !== ctx.userId) throw new Error('account_changed');
}

export async function getForYouContext(userId, language, now = new Date()) {
    const zone = timezone();
    const day = localDay(now, zone);
    try {
        const prefsTask = guest(userId) ? Promise.resolve(readLocal(userId, 'preferences', { preferences: { topics: {} }, version: 1 }))
            : rpc('for_you_get_preferences');
        const eventsTask = guest(userId) ? Promise.resolve([]) : Promise.all([
            supabase.from('search_logs').select('query,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
            supabase.from('ai_questions').select('question,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        ]).then(results => {
            for (const result of results) if (result.error) throw new Error(result.error.message);
            return results.flatMap(r => r.data || []).sort((a, b) => b.created_at.localeCompare(a.created_at));
        });
        const contentTask = guest(userId) ? Promise.resolve(readLocal(userId, 'history', []))
            : supabase.from('for_you_content').select('*').eq('user_id', userId).order('generated_at', { ascending: false }).order('id').limit(90)
                .then(r => { if (r.error) throw new Error(r.error.message); return r.data.map(payloadOf).filter(Boolean); });
        const feedbackTask = guest(userId) ? Promise.resolve(readLocal(userId, 'feedback', {}))
            : supabase.from('for_you_feedback').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(300)
                .then(r => { if (r.error) throw new Error(r.error.message); return Object.fromEntries(r.data.map(f => [f.content_id, f])); });
        const [prefs, events, history, feedback, books, activePlan] = await Promise.all([
            prefsTask, eventsTask, contentTask, feedbackTask, getBooks(),
            guest(userId) ? Promise.resolve({ data: null }) : getActivePlan().catch(() => ({ data: null })),
        ]);
        if (!books.success) throw new Error('bible_catalogue_unavailable');
        let legacy = null;
        if (!guest(userId) && !history.some(item => item.language === language && item.slot === 'devotional')) {
            const old = await supabase.from('user_devotionals').select('id,title,content,topics,generated_date,last_refresh')
                .eq('user_id', userId).order('last_refresh', { ascending: false }).limit(1).maybeSingle();
            const item = old.data;
            if (!old.error && item?.topics?.[0] === language && item.content && item.title !== 'Pending'
                && item.content !== 'Devotional pending generation') {
                const oldTopics = matchTopics(item.topics.slice(1).join(' '));
                const states = preferenceStates(prefs.preferences);
                if (!oldTopics.some(id => states[id] === 'exclude')) legacy = {
                    id: `legacy-${item.id}`, legacy: true, slot: 'devotional', language, day: item.generated_date,
                    title: item.title, paragraphs: item.content.replace(/\*\*/g, '').split(/\n\s*\n/),
                    closing: '', passage: null, format_id: 'quiet_reflection', topic_id: oldTopics[0] || null,
                };
            }
        }
        const preferences = prefs.preferences || { topics: {} };
        const lessLike = history.filter(item => feedback[item.id]?.less_like);
        const interests = rankInterests(events, preferences, now.getTime()).map(interest => ({
            ...interest, score: interest.score * (lessLike.some(item => item.topic_id === interest.id) ? 0.5 : 1),
        })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        const ctx = { userId, language, zone, day, guest: guest(userId), prefs, interests, history, feedback, legacy, books: books.data, activePlan: activePlan.data, offline: false };
        try { writeLocal(userId, `context:${language}`, ctx); } catch { /* cloud remains authoritative */ }
        return ctx;
    } catch (error) {
        const previous = readLocal(userId, `context:${language}`, null);
        if (previous?.userId === userId && previous.language === language) return { ...previous, day, zone, offline: true, loadError: error.message };
        throw error;
    }
}

export function getForYouPlan(ctx, refresh = 0, keepSlots = []) {
    const plan = planForYou({ userId: ctx.userId, language: ctx.language, day: ctx.day,
        preferences: ctx.prefs.preferences, interests: ctx.interests,
        history: ctx.history.map(item => ({ ...item, less_like: ctx.feedback[item.id]?.less_like })), refresh,
        lockedItems: keepSlots.map(slot => cachedForSlot(ctx, slot)).filter(Boolean) });
    // A "less like this" choice is a ranking signal, not a permanent topic ban.
    // Prefer a different eligible plan on the next explicit refresh.
    return plan;
}

export function cachedForSlot(ctx, slot) {
    const states = preferenceStates(ctx.prefs.preferences);
    return ctx.history.find(item => item.language === ctx.language && item.day === ctx.day && item.slot === slot
        && states[item.topic_id] !== 'exclude' && item.prompt_version === FOR_YOU_VERSION) || null;
}

async function verifiedPassage(ctx, spec) {
    const book = resolveDbBook(ctx.books, spec.passage.book);
    if (!book) throw new Error('passage_book_unavailable');
    const meta = getCanonicalBookMeta(spec.passage.book);
    if (Number(book.order) !== spec.passage.book && book.name_full !== meta?.name) throw new Error('passage_book_mismatch');
    // No silent cross-language fallback; try the available corpus for this language only.
    const versions = ctx.language === 'af' ? ['AFR53', 'AFR83'] : ['KJV'];
    for (const version of versions) {
        const result = await supabase.from('verses').select('verse,text').eq('book_id', book.id)
            .eq('chapter', spec.passage.chapter).eq('version', version).order('verse');
        if (result.error) throw new Error(result.error.message);
        const rows = result.data || [];
        const selected = rows.filter(v => v.verse >= spec.passage.start && v.verse <= spec.passage.end);
        if (selected.length !== spec.passage.end - spec.passage.start + 1 || selected.some(v => !v.text)) continue;
        return {
            book_id: book.id, chapter: spec.passage.chapter, start: spec.passage.start, end: spec.passage.end,
            version, reference: `${ctx.language === 'af' ? meta.name_af : meta.name} ${spec.passage.chapter}:${spec.passage.start}–${spec.passage.end}`,
            verses: selected.map(v => ({ verse: v.verse, text: v.text })),
            context: rows.slice(Math.max(0, spec.passage.start - 5), spec.passage.end + 4).map(v => `${v.verse}. ${v.text}`).join('\n'),
        };
    }
    throw new Error('verified_passage_unavailable');
}

export function buildForYouPrompt(spec, passage, history) {
    const format = FOR_YOU_FORMATS[spec.format_id];
    const recent = history.filter(h => h.language === spec.language).slice(0, 5)
        .map(h => ({ title: h.title, opening: h.paragraphs?.[0]?.slice(0, 180), closing: h.closing?.slice(0, 120) }));
    return `Write Bible study content in ${spec.language === 'af' ? 'natural Afrikaans' : 'English'}.
Format: ${spec.format_id}. Topic: ${topicLabel(spec.topic_id, spec.language)}.
${format.brief}
Target ${format.words[0]}–${format.words[1]} words. Chosen ending: ${spec.ending}.
${spec.passage.person ? `Narrative person: ${spec.passage.person}.` : ''}
Verified passage: ${passage.reference} (${passage.version}).
PASSAGE: ${JSON.stringify(passage.verses)}
SURROUNDING TEXT: ${passage.context}
Use the supplied passage as the foundation. Distinguish observation, interpretation and application.
Return commentary only: the app displays the actual quotation separately. Do not invent or quote other verses/references.
Do not invent historical facts, research citations, private thoughts or dialogue. Historical context must be supported by this supplied text; literary context is enough.
Never assume the reader's personal circumstances from their interests. Do not promise a financial, medical or relationship outcome.
Keep the voice suited to the format: explanation is not a pep talk. No generic greetings or repeated motivational filler.
Avoid copying recent titles, openings and endings: ${JSON.stringify(recent)}
Return ONLY JSON: {"title":"specific title","summary":"one sentence","paragraphs":["plain text paragraph","plain text paragraph"],"closing":"optional plain text ending"}.
No HTML or Markdown. The ending must suit the format; not every piece needs a question, prayer or action.`;
}

export async function getForYouPiece(ctx, spec, { force = false } = {}) {
    const workKey = `${ctx.userId}:${ctx.language}:${ctx.day}:${spec.slot}`;
    if (pending.has(workKey)) return pending.get(workKey);
    const task = () => generatePiece(ctx, spec, force);
    const promise = (typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(workKey, task) : task()).finally(() => pending.delete(workKey));
    pending.set(workKey, promise);
    return promise;
}

async function generatePiece(ctx, spec, force) {
    const fingerprint = `${FOR_YOU_VERSION}:${ctx.prefs.version}:${ctx.language}`;
    const localName = `slot:${ctx.language}:${ctx.day}:${spec.slot}`;
    const local = readLocal(ctx.userId, localName, null);
    const states = preferenceStates(ctx.prefs.preferences);
    const cached = cachedForSlot(ctx, spec.slot) || (states[local?.content?.topic_id] !== 'exclude' ? local?.content : null)
        || (spec.slot === 'devotional' && ctx.legacy && states[ctx.legacy.topic_id] !== 'exclude' ? ctx.legacy : null);
    if (ctx.offline) return { content: cached || null, status: 'offline' };
    let token;
    try {
        await assertAccount(ctx);
        if (ctx.guest) {
            if (!force && cached && local?.fingerprint === fingerprint) return { content: cached, status: 'cached' };
            const hours = await isRateLimitEnabled() ? 24 : 1;
            if (force && local && Date.now() - Date.parse(local.content.generated_at) < hours * 3600000) {
                return { content: cached || null, status: 'cooldown' };
            }
        } else {
            const claim = await rpc('for_you_claim_content', { p_timezone: ctx.zone, p_language: ctx.language,
                p_slot: spec.slot, p_fingerprint: fingerprint, p_force: force });
            if (claim.status !== 'claimed') {
                const existing = payloadOf(claim.content);
                return { content: existing && states[existing.topic_id] !== 'exclude' ? existing : cached || null, status: claim.status, availableAt: claim.available_at };
            }
            if (!sameDay(claim.day, ctx.day)) {
                await rpc('for_you_release_content', { p_token: claim.token });
                throw new Error('day_changed_reload');
            }
            token = claim.token;
        }
        const passage = await verifiedPassage(ctx, spec);
        // No new shared quota rule is introduced; For You retains its existing cooldown policy.
        const prompt = buildForYouPrompt(spec, passage, ctx.history);
        let generated;
        for (let attempt = 0; attempt < 3; attempt++) {
            let timeout;
            try {
                const repairNote = attempt
                    ? '\nYour last answer was not valid JSON. Return ONLY one JSON object: {"title":"...","summary":"...","paragraphs":["...","..."],"closing":"..."}. Use double quotes. Escape quotes inside strings. At least two paragraphs, 70+ words total. Plain text only.'
                    : '';
                const raw = await Promise.race([
                    generateForYouAiText(prompt + repairNote),
                    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('generation_timeout')), 90000); }),
                ]);
                void logApiCall('generateForYou', 'success', getAiModelLabel(), { format: spec.format_id, language: ctx.language });
                generated = validateGeneratedPiece(raw);
                const opening = generated.paragraphs[0].toLowerCase().split(/\s+/).slice(0, 10).join(' ');
                if (ctx.history.slice(0, 5).some(item => item.paragraphs?.[0]?.toLowerCase().startsWith(opening))) throw new Error('repeated_opening');
                break;
            } catch (error) {
                const repairable = error instanceof SyntaxError
                    || /JSON/i.test(error.message)
                    || /^(invalid_|unverified_|repeated_)/.test(error.message);
                if (attempt >= 2 || !repairable) throw error;
            } finally { clearTimeout(timeout); }
        }
        const content = { ...generated, ...spec, passage: { ...passage, context: undefined }, generated_at: new Date().toISOString() };
        await assertAccount(ctx);
        let saved;
        if (ctx.guest) {
            saved = { ...content, id: `guest-${stableHash(JSON.stringify(content))}` };
            const history = readLocal(ctx.userId, 'history', []);
            writeLocal(ctx.userId, 'history', [saved, ...history].slice(0, 90));
        } else {
            saved = payloadOf(await rpc('for_you_complete_content', { p_token: token, p_fingerprint: fingerprint, p_payload: content }));
            if (!saved) throw new Error('invalid_saved_content');
            token = null;
        }
        // Cloud success should not be reported as failure merely because a local cache is full.
        try { writeLocal(ctx.userId, localName, { fingerprint, content: saved }); } catch { /* read from cloud next time */ }
        return { content: saved, status: 'generated' };
    } catch (error) {
        console.warn('[For You] section failed:', error.message);
        return { content: cached || null, status: 'error', error: error.message };
    } finally {
        if (token) await rpc('for_you_release_content', { p_token: token }).catch(() => {});
    }
}

export async function patchForYouInterest(ctx, topicId, state) {
    if (ctx.offline) throw new Error('preferences_offline');
    await assertAccount(ctx);
    if (ctx.guest) {
        const prefs = { version: ctx.prefs.version + 1, preferences: { ...ctx.prefs.preferences,
            topics: { ...ctx.prefs.preferences.topics, [topicId]: state } } };
        writeLocal(ctx.userId, 'preferences', prefs);
        return prefs;
    }
    return rpc('for_you_patch_preferences', { p_version: ctx.prefs.version, p_topic: topicId, p_state: state });
}

export async function setForYouFeedback(ctx, contentId, field, value) {
    if (!['saved', 'helpful', 'read', 'less_like'].includes(field)) throw new Error('invalid_feedback');
    if (ctx.offline) throw new Error('feedback_offline');
    await assertAccount(ctx);
    if (ctx.guest) {
        const feedback = readLocal(ctx.userId, 'feedback', {});
        const row = { ...feedback[contentId], [field]: value };
        writeLocal(ctx.userId, 'feedback', { ...feedback, [contentId]: row });
        return row;
    }
    return rpc('for_you_set_feedback', { p_content_id: contentId, p_field: field, p_value: value });
}

export async function getSavedForYou(ctx) {
    if (ctx.guest) return readLocal(ctx.userId, 'history', []).filter(item => readLocal(ctx.userId, 'feedback', {})[item.id]?.saved);
    const feedback = [];
    for (let from = 0; ; from += 500) {
        const page = await supabase.from('for_you_feedback').select('*').eq('user_id', ctx.userId).eq('saved', true)
            .order('updated_at', { ascending: false }).order('content_id').range(from, from + 499);
        if (page.error) throw new Error(page.error.message);
        feedback.push(...page.data);
        if (page.data.length < 500) break;
    }
    const ids = feedback.map(f => f.content_id);
    const result = [];
    for (let from = 0; from < ids.length; from += 100) {
        const rows = await supabase.from('for_you_content').select('*').eq('user_id', ctx.userId).in('id', ids.slice(from, from + 100));
        if (rows.error) throw new Error(rows.error.message);
        result.push(...rows.data.filter(row => payloadOf(row)).map(row => ({ ...payloadOf(row), feedback: feedback.find(f => f.content_id === row.id) })));
    }
    return result.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}
