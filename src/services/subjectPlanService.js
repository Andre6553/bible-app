import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';
import { logEvent } from './analyticsService';
import { analyzeUserInterests } from './blogService';
import { CANONICAL_BOOKS, CANONICAL_BOOKS_BY_ID } from '../constants/canonicalBooks';
import { enrichSubjectPlanReadings } from './planCommentaryEnrichment';

/**
 * Subject Plan Service
 * ---------------------
 * AI-generated, per-user reading plans that tackle a subject (e.g. "Faith",
 * "Anxiety", "Forgiveness"). Curated subject chips plus history-derived
 * suggestions feed into a single Gemini/Groq call that returns a full study
 * structure compatible with the existing reading_plans / user_reading_plans
 * pipeline (so PlanDayReading, commentary, notes, etc. all "just work").
 *
 * See `src/sql_imports/subject_plans_migration.sql` for the schema additions.
 */

import {
    AI_PROVIDER,
    GEMINI_API_KEY,
    GROQ_API_KEY,
    GEMINI_MODEL,
    GROQ_MODEL,
    GROQ_CHAT_URL,
    buildGroqChatBody,
    extractGroqMessageContent,
    shouldFallbackFromGroq,
} from '../config/aiConfig';

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: GEMINI_MODEL }) : null;

// =====================================================
// Curated subject chips (also used as keyword anchors)
// =====================================================

/** Curated chip list — kept stable; AI history suggestions are merged on top. */
export const SUBJECT_CHIPS = [
    { slug: 'faith', en: 'Faith', af: 'Geloof', emoji: '🌱', keywords: ['faith', 'believe', 'trust', 'geloof', 'glo', 'vertrou'] },
    { slug: 'hope', en: 'Hope', af: 'Hoop', emoji: '⚓', keywords: ['hope', 'hoop'] },
    { slug: 'love', en: 'Love', af: 'Liefde', emoji: '❤️', keywords: ['love', 'liefde'] },
    { slug: 'anxiety', en: 'Anxiety & Worry', af: 'Angs & Kommer', emoji: '🕊️', keywords: ['anxiety', 'worry', 'fear', 'afraid', 'angs', 'vrees', 'bang', 'kommer'] },
    { slug: 'forgiveness', en: 'Forgiveness', af: 'Vergifnis', emoji: '🤝', keywords: ['forgive', 'forgiveness', 'vergewe', 'vergifnis', 'pardon'] },
    { slug: 'prayer', en: 'Prayer', af: 'Gebed', emoji: '🙏', keywords: ['prayer', 'pray', 'bid', 'gebed'] },
    { slug: 'identity', en: 'Identity in Christ', af: 'Identiteit in Christus', emoji: '👤', keywords: ['identity', 'who am i', 'identiteit', 'waarde'] },
    { slug: 'purpose', en: 'Purpose & Calling', af: 'Doel & Roeping', emoji: '🧭', keywords: ['purpose', 'calling', 'doel', 'roeping'] },
    { slug: 'grief', en: 'Grief & Comfort', af: 'Smart & Troos', emoji: '🌧️', keywords: ['grief', 'comfort', 'mourning', 'loss', 'smart', 'verdriet', 'troos'] },
    { slug: 'wisdom', en: 'Wisdom', af: 'Wysheid', emoji: '🦉', keywords: ['wisdom', 'wise', 'proverb', 'wysheid', 'verstand'] },
    { slug: 'peace', en: 'Peace', af: 'Vrede', emoji: '🕊️', keywords: ['peace', 'calm', 'vrede', 'rustigheid'] },
    { slug: 'strength', en: 'Strength & Courage', af: 'Sterkte & Moed', emoji: '💪', keywords: ['strength', 'strong', 'courage', 'sterkte', 'krag', 'moed'] },
    { slug: 'joy', en: 'Joy', af: 'Vreugde', emoji: '✨', keywords: ['joy', 'happiness', 'vreugde', 'blydskap'] },
    { slug: 'family', en: 'Family & Marriage', af: 'Familie & Huwelik', emoji: '🏠', keywords: ['family', 'marriage', 'parent', 'children', 'familie', 'huwelik', 'gesin'] },
    { slug: 'money', en: 'Money & Contentment', af: 'Geld & Tevredenheid', emoji: '🪙', keywords: ['money', 'wealth', 'giving', 'contentment', 'geld', 'rykdom'] },
    { slug: 'salvation', en: 'Salvation', af: 'Redding', emoji: '✝️', keywords: ['salvation', 'saved', 'redding', 'saligheid'] },
    { slug: 'grace', en: 'Grace & Mercy', af: 'Genade & Barmhartigheid', emoji: '🌿', keywords: ['grace', 'mercy', 'genade', 'barmhartigheid'] },
    { slug: 'healing', en: 'Healing', af: 'Genesing', emoji: '🩹', keywords: ['healing', 'heal', 'health', 'genesing', 'genees'] },
    { slug: 'know_jesus', en: 'Knowing Jesus', af: 'Ken Jesus', emoji: '👑', keywords: ['jesus', 'christ', 'gospel', 'messiah', 'evangelie'] },
    { slug: 'temptation', en: 'Temptation & Sin', af: 'Versoeking & Sonde', emoji: '🛡️', keywords: ['temptation', 'sin', 'guilt', 'versoeking', 'sonde', 'skuld'] },
];

const SUBJECT_BY_SLUG = Object.fromEntries(SUBJECT_CHIPS.map((c) => [c.slug, c]));

export function getSubjectChip(slug) {
    return SUBJECT_BY_SLUG[slug] || null;
}

export function getSubjectLabel(chip, language = 'en') {
    if (!chip) return '';
    return language === 'af' ? chip.af : chip.en;
}

// =====================================================
// History-derived suggestions (search_logs + ai_questions)
// =====================================================

/**
 * Inspect the user's recent searches and AI questions, then surface the top
 * curated subjects with a `weight` (mention count). Returns at most `limit`
 * suggestions, sorted strongest first. Returns [] for guests or on failure.
 */
export async function getSuggestedSubjectsFromHistory({ limit = 3, language = 'en' } = {}) {
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: true, suggestions: [], isGuest: true };
        }

        const { success, topics } = await analyzeUserInterests(userId);
        if (!success || !topics?.length) {
            return { success: true, suggestions: [], isGuest: false };
        }

        const seen = new Set();
        const suggestions = [];

        for (const { topic, weight } of topics) {
            const lower = String(topic || '').toLowerCase();
            const chip = SUBJECT_CHIPS.find(
                (c) => c.slug === lower || c.keywords.some((kw) => lower.includes(kw)),
            );
            if (!chip || seen.has(chip.slug)) continue;
            seen.add(chip.slug);
            suggestions.push({
                chip,
                weight,
                label: getSubjectLabel(chip, language),
                reasonEn: `Based on your searches about ${chip.en.toLowerCase()}`,
                reasonAf: `Gebaseer op jou soektogte oor ${chip.af.toLowerCase()}`,
            });
            if (suggestions.length >= limit) break;
        }

        return { success: true, suggestions, isGuest: false };
    } catch (err) {
        console.error('[SubjectPlans] getSuggestedSubjectsFromHistory:', err);
        return { success: false, suggestions: [], error: err.message };
    }
}

// =====================================================
// AI generation
// =====================================================

const BOOK_LIST_FOR_PROMPT = CANONICAL_BOOKS.map((b) => `${b.id}=${b.name}(${b.chapters})`).join(', ');

/**
 * Curated lenses used to vary AI-generated subject plans across regenerations.
 * Each new plan on the same subject picks the next lens in this list so the
 * user gets a meaningfully different angle (not just shuffled chapters).
 */
const SUBJECT_LENSES = [
    {
        key: 'ot_foundations',
        en: 'Old Testament foundations — anchor this subject in Torah, history, and narrative (book_id 1–17). Show how it surfaces in real lives long before the cross.',
        af: 'Ou-Testamentiese fondamente — anker hierdie onderwerp in Tora, geskiedenis en verhaal (boek 1–17).',
    },
    {
        key: 'gospel_encounters',
        en: 'Gospel encounters — focus on how Jesus reveals or teaches this subject (book_id 40–43). Use moments where he speaks, heals, or confronts.',
        af: 'Evangelie-ontmoetings — fokus op hoe Jesus hierdie onderwerp openbaar (boek 40–43).',
    },
    {
        key: 'apostolic_teaching',
        en: 'Apostolic teaching — explore how the epistles unpack this subject for the early church (book_id 45–65). Doctrine, ethics, and pastoral application.',
        af: 'Apostoliese onderrig — verken hoe die briewe hierdie onderwerp vir die vroeë kerk uitpak (boek 45–65).',
    },
    {
        key: 'psalms_and_prayers',
        en: 'Psalms and prayers — walk through this subject in the prayer-life of God\'s people, especially Psalms (book_id 19) and prayed prayers across Scripture.',
        af: 'Psalms en gebede — loop deur hierdie onderwerp in die gebedslewe van God se volk (Psalms en gebede regdeur die Skrif).',
    },
    {
        key: 'prophets',
        en: 'Prophetic voice — show how the prophets (book_id 23–39) confront, comfort, and point forward to Christ on this subject.',
        af: 'Profetiese stem — wys hoe die profete (boek 23–39) hierdie onderwerp konfronteer en op Christus wys.',
    },
    {
        key: 'wisdom',
        en: 'Wisdom literature — draw on Job, Proverbs, Ecclesiastes, and Song of Solomon (book_id 18, 20–22) for the practical, lived-out side of this subject.',
        af: 'Wysheidsliteratuur — put uit Job, Spreuke, Prediker en Hooglied (boek 18, 20–22) vir die praktiese kant van hierdie onderwerp.',
    },
    {
        key: 'characters',
        en: 'Character studies — anchor each day in one named biblical character (Abraham, Hannah, David, Daniel, Peter, Mary, Paul…) and show this subject in their story.',
        af: 'Karakterstudies — fokus elke dag op een Bybelse karakter (Abraham, Hanna, Dawid, Daniël, Petrus, Maria, Paulus…).',
    },
    {
        key: 'promises_and_hope',
        en: 'Promises and hope — gather God\'s direct promises, covenant statements, and future-pointing texts that touch this subject.',
        af: 'Beloftes en hoop — versamel God se direkte beloftes en toekomsbeloftes oor hierdie onderwerp.',
    },
];

/**
 * Pull the user's full subject-plan history (active + soft-deleted) for a
 * subject. Used to (1) pick a fresh lens and (2) tell the AI which chapters
 * have already been visited so it can pick different ones.
 *
 * Matches loosely on `subject` (lowercased) so chip slug ("faith") or free-text
 * ("Faith") both find prior plans.
 */
export async function getSubjectPlanHistory(userId, subjectKey) {
    if (!userId || userId.startsWith('user_') || !subjectKey) {
        return { count: 0, usedChapters: [], usedLenses: [] };
    }
    try {
        const key = String(subjectKey).trim().toLowerCase();
        const { data, error } = await supabase
            .from('reading_plans')
            .select('readings, subject, generation_model, created_at, source')
            .or(`created_by_user_id.eq.${userId},original_owner_id.eq.${userId}`)
            .ilike('subject', key)
            .order('created_at', { ascending: true });

        if (error) {
            // Column missing → treat as empty history (migration not run yet).
            const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
            if (
                error.code === '42703' ||
                error.code === 'PGRST204' ||
                msg.includes('is_personal') ||
                msg.includes('subject')
            ) {
                return { count: 0, usedChapters: [], usedLenses: [] };
            }
            throw error;
        }

        const usedChapters = new Set();
        const usedLenses = [];
        for (const row of data || []) {
            if (Array.isArray(row?.readings)) {
                for (const day of row.readings) {
                    for (const p of day?.passages || []) {
                        const bookId = Number(p?.book_id);
                        const chapter = Number(p?.chapter);
                        if (bookId && chapter) usedChapters.add(`${bookId}:${chapter}`);
                    }
                }
            }
            // Lens is stored in `source` as `ai_subject_generator:<lens_key>`
            // or `ai_auto:<lens_key>` — split on ':' picks the lens key for both.
            const lensFromSource = String(row?.source || '').split(':')[1];
            if (lensFromSource) usedLenses.push(lensFromSource);
        }

        return {
            count: (data || []).length,
            usedChapters: Array.from(usedChapters),
            usedLenses,
        };
    } catch (err) {
        console.warn('[SubjectPlans] getSubjectPlanHistory:', err?.message);
        return { count: 0, usedChapters: [], usedLenses: [] };
    }
}

/**
 * Pick the next lens for this subject — rotates through SUBJECT_LENSES so the
 * user gets a different angle every time, then loops back once exhausted.
 */
function pickNextLens(usedLenses = []) {
    const usedSet = new Set(usedLenses);
    const fresh = SUBJECT_LENSES.find((l) => !usedSet.has(l.key));
    if (fresh) return fresh;
    // All lenses used — loop with the least-recently-used (first in usedLenses array).
    const oldestKey = usedLenses[0];
    return SUBJECT_LENSES.find((l) => l.key === oldestKey) || SUBJECT_LENSES[0];
}

function buildPrompt(subject, durationDays, language, options = {}) {
    const langName = language === 'af' ? 'Afrikaans' : 'English';
    const { lens = null, usedChapters = [] } = options;

    const lensBlock = lens
        ? `\nFRESH ANGLE (REQUIRED): ${lens.en}\nAfrikaans angle: ${lens.af}\nApply this angle consistently across all ${durationDays} days.\n`
        : '';

    const avoidBlock = usedChapters.length
        ? `\nALREADY-USED CHAPTERS (avoid in this plan): ${usedChapters.join(', ')}\nDo NOT reuse any of these book_id:chapter pairs — the reader has already studied them in a previous plan on "${subject}". Pick fresh chapters that still develop the subject.\n`
        : '';

    return `You are a Bible study editor building a ${durationDays}-day guided journey on the subject: "${subject}".

Readers must NOT feel they could skip the plan and "just read the Bible." Your job is to teach WHY each chapter is on this journey, HOW it develops "${subject}", and WHAT to watch for before they read the verses.

The app attaches per-chapter summaries, study points, teaching, and cross-references automatically. You write the SUBJECT GUIDE layer: plan overview, rich daily intros, and reflection questions.

BIBLICAL GROUNDING (NON-NEGOTIABLE):
- Every claim must be traceable to what the actual chosen chapter records — quote or refer to verse numbers.
- Do NOT speculate beyond Scripture (no novel doctrine, no extra-biblical "interpretation," no opinion presented as God's voice).
- Do NOT contradict the historic Christian faith (creation, fall, incarnation, atonement, resurrection, return of Christ).
- Do NOT use the chapter as a springboard for unrelated themes — stay on what the text plainly teaches and how it touches "${subject}".
- If a chapter has multiple themes, you may pick the one most relevant to "${subject}" but you must not misrepresent the text.

LANGUAGE: BOTH English and Afrikaans for every string field. Primary reader: ${langName}.

CANON: book_id 1–66 only. Valid chapters only (max in parentheses).
${BOOK_LIST_FOR_PROMPT}
${lensBlock}${avoidBlock}
RULES:
- Choose chapters where "${subject}" is visible in the story, teaching, or prayer of that text — not isolated slogans.
- One chapter per day. Vary OT and NT. No repeated chapters.
- passages[0].verse_start / verse_end (REQUIRED): the SPECIFIC verse range inside the chapter that develops "${subject}". The reader will see the whole chapter for context, but the reader will auto-scroll to verse_start and visually highlight verses verse_start..verse_end. Choose tight, meaningful ranges (typically 4–25 verses). Both must be valid verses in that chapter and verse_end >= verse_start.
- commentary_intro_en/af (CRITICAL): Write 8–12 sentences (about 150–250 words) per day. Structure:
  (1) Where this day fits in the ${durationDays}-day "${subject}" arc (day X of Y).
  (2) Why THIS chapter was chosen for "${subject}" today.
  (3) Historical/literary context in 1–2 sentences (who, when, situation).
  (4) What themes or verses to watch for as they read.
  (5) One concrete application or prayer direction tied to "${subject}".
  Do NOT repeat the chapter summary verbatim — explain the SUBJECT journey.
- questions_en/af: 3 substantial reflection questions (full sentences) tying the chapter AND "${subject}" together.
- study_guide_en/af: 5–7 sentences — overall aim of the plan, how to use each day (read intro → study notes → Scripture → questions), and encouragement.
- description_en/af: 200–400 characters — who this plan is for, what they'll understand about "${subject}", and the outcome.
- Do NOT include commentary_sections.

OUTPUT: Return ONLY valid JSON:

{
  "title_en": "string",
  "title_af": "string",
  "description_en": "string (200–400 chars)",
  "description_af": "string",
  "study_guide_en": "string (5–7 sentences)",
  "study_guide_af": "string",
  "cover_emoji": "emoji",
  "readings": [
    {
      "day": 1,
      "passages": [{ "book_id": <1-66>, "chapter": <int>, "verse_start": <int>, "verse_end": <int> }],
      "commentary_intro_en": "8–12 sentences, 150–250 words",
      "commentary_intro_af": "8–12 sentences",
      "questions_en": ["full question 1", "full question 2", "full question 3"],
      "questions_af": ["?", "?", "?"]
    }
  ]
}

Exactly ${durationDays} readings, days 1..${durationDays}. Return ONLY JSON.`;
}

/** Compact prompt for community pool backfill — smaller JSON, fewer parse failures. */
function buildPoolBackfillPrompt(subject, durationDays, language, options = {}) {
    const langName = language === 'af' ? 'Afrikaans' : 'English';
    const { usedChapters = [] } = options;
    const avoidBlock = usedChapters.length
        ? `\nAvoid chapters already used: ${usedChapters.join(', ')}.\n`
        : '';

    return `Build a ${durationDays}-day Bible reading plan JSON on "${subject}" (${langName} reader). Both en and af for every string.

CANON book_id 1-66 only. One chapter per day, varied OT/NT. verse_start and verse_end required per passage.
${avoidBlock}
Keep commentary_intro_en/af to 3-4 short sentences each (under 80 words). Three questions per day.

JSON RULES: Valid JSON only. No trailing commas. No literal line breaks inside strings — use spaces only. Escape double quotes inside strings.

Return ONLY this shape:
{"title_en":"","title_af":"","description_en":"","description_af":"","study_guide_en":"","study_guide_af":"","cover_emoji":"📖","readings":[{"day":1,"passages":[{"book_id":43,"chapter":3,"verse_start":1,"verse_end":16}],"commentary_intro_en":"","commentary_intro_af":"","questions_en":["","",""],"questions_af":["","",""]}]}

Exactly ${durationDays} readings (days 1..${durationDays}).`;
}

/** Passages used when AI omits a day (pool backfill only — keeps plans usable). */
const GENERIC_FALLBACK_PASSAGES = [
    { book_id: 19, chapter: 23, verse_start: 1, verse_end: 6 },
    { book_id: 43, chapter: 3, verse_start: 1, verse_end: 21 },
    { book_id: 45, chapter: 8, verse_start: 28, verse_end: 39 },
    { book_id: 40, chapter: 5, verse_start: 1, verse_end: 16 },
    { book_id: 1, chapter: 15, verse_start: 1, verse_end: 21 },
];

const SUBJECT_FALLBACK_PASSAGES = {
    faith: [
        { book_id: 58, chapter: 11, verse_start: 1, verse_end: 6 },
        { book_id: 45, chapter: 4, verse_start: 1, verse_end: 12 },
        { book_id: 40, chapter: 17, verse_start: 14, verse_end: 20 },
    ],
    prayer: [
        { book_id: 40, chapter: 6, verse_start: 5, verse_end: 15 },
        { book_id: 19, chapter: 23, verse_start: 1, verse_end: 6 },
        { book_id: 42, chapter: 18, verse_start: 1, verse_end: 8 },
    ],
    hope: [
        { book_id: 45, chapter: 15, verse_start: 1, verse_end: 13 },
        { book_id: 19, chapter: 42, verse_start: 1, verse_end: 11 },
        { book_id: 49, chapter: 1, verse_start: 3, verse_end: 14 },
    ],
    love: [
        { book_id: 46, chapter: 13, verse_start: 1, verse_end: 13 },
        { book_id: 43, chapter: 15, verse_start: 9, verse_end: 17 },
        { book_id: 62, chapter: 4, verse_start: 7, verse_end: 21 },
    ],
    forgiveness: [
        { book_id: 40, chapter: 18, verse_start: 21, verse_end: 35 },
        { book_id: 42, chapter: 23, verse_start: 32, verse_end: 43 },
        { book_id: 45, chapter: 5, verse_start: 1, verse_end: 11 },
    ],
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return (
        msg.includes('429') ||
        msg.includes('rate limit') ||
        msg.includes('resource exhausted') ||
        msg.includes('too many requests')
    );
}

const AI_RATE_LIMIT_UNTIL_KEY = 'bible_ai_rate_limit_until';
const AI_RATE_LIMIT_COOLDOWN_MS = 20 * 60 * 1000;

function setAiRateLimitCooldown() {
    try {
        sessionStorage.setItem(
            AI_RATE_LIMIT_UNTIL_KEY,
            String(Date.now() + AI_RATE_LIMIT_COOLDOWN_MS),
        );
    } catch {}
}

export function isAiInCooldown() {
    try {
        const until = Number(sessionStorage.getItem(AI_RATE_LIMIT_UNTIL_KEY) || 0);
        return until > Date.now();
    } catch {
        return false;
    }
}

export function getAiCooldownMinutesLeft() {
    try {
        const until = Number(sessionStorage.getItem(AI_RATE_LIMIT_UNTIL_KEY) || 0);
        const ms = until - Date.now();
        return ms > 0 ? Math.ceil(ms / 60000) : 0;
    } catch {
        return 0;
    }
}

function escapeNewlinesInJsonStrings(input) {
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (!inString) {
            out += ch;
            if (ch === '"') {
                inString = true;
                escaped = false;
            }
            continue;
        }
        if (escaped) {
            out += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            out += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            out += ch;
            inString = false;
            continue;
        }
        if (ch === '\n' || ch === '\r') {
            out += '\\n';
            continue;
        }
        out += ch;
    }
    return out;
}

function repairJsonCandidate(jsonStr) {
    let s = jsonStr;
    s = s.replace(/[\u201c\u201d]/g, '"');
    s = s.replace(/[\u2018\u2019]/g, "'");
    s = s.replace(/,\s*([\]}])/g, '$1');
    s = escapeNewlinesInJsonStrings(s);
    s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
    return s;
}

function extractJsonObject(text) {
    if (!text) throw new Error('AI returned empty output');
    const stripped = text.replace(/```json|```/gi, '').trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('AI did not return a JSON object');
    }
    const slice = stripped.substring(start, end + 1);
    const attempts = [
        () => JSON.parse(slice),
        () => JSON.parse(repairJsonCandidate(slice)),
        () => JSON.parse(repairJsonCandidate(slice.replace(/,\s*\}/g, '}'))),
    ];
    let lastErr;
    for (const attempt of attempts) {
        try {
            return attempt();
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr;
}

function buildSyntheticPoolPayload(subjectLabel, subjectSlug, durationDays, language = 'en') {
    const chip = getSubjectChip(subjectSlug);
    const readings = [];
    for (let day = 1; day <= durationDays; day += 1) {
        readings.push(buildFallbackReading(day, subjectSlug, subjectLabel, language));
    }
    return {
        title_en: `${subjectLabel} — ${durationDays} days`,
        title_af: `${subjectLabel} — ${durationDays} dae`,
        description_en: `A ${durationDays}-day Scripture journey exploring ${subjectLabel}.`,
        description_af: `'n ${durationDays}-dag Skrifreis oor ${subjectLabel}.`,
        study_guide_en: 'Each day: read the intro, open the passage, then answer the reflection questions.',
        study_guide_af: 'Elke dag: lees die inleiding, open die gedeelte, en beantwoord die refleksievrae.',
        cover_emoji: chip?.emoji || '📖',
        readings,
    };
}

function buildFallbackReading(dayNumber, subjectSlug, subjectLabel, language = 'en') {
    const pool = SUBJECT_FALLBACK_PASSAGES[subjectSlug] || GENERIC_FALLBACK_PASSAGES;
    const passage = pool[(dayNumber - 1) % pool.length];
    const label = subjectLabel || 'this subject';
    const enIntro = `Day ${dayNumber}: read this passage as part of your journey through "${label}". Notice how the text speaks to ${label} in its own context, then reflect with the questions below.`;
    const afIntro = `Dag ${dayNumber}: lees hierdie gedeelte as deel van jou reis deur "${label}". Let op hoe die teks tot ${label} in sy eie konteks spreek.`;
    return {
        day: dayNumber,
        passages: [passage],
        commentary_intro_en: enIntro,
        commentary_intro_af: afIntro,
        questions_en: [
            `What does this passage reveal about ${label}?`,
            `How does today's reading connect to the overall theme?`,
            `What will you apply or pray about from this text?`,
        ],
        questions_af: [
            `Wat openbaar hierdie gedeelte oor ${label}?`,
            `Hoe verbind vandag se leesstuk met die algehele tema?`,
            `Wat sal jy uit hierdie teks toepas of daaroor bid?`,
        ],
    };
}

async function callAi(prompt) {
    const groqCooldown = isAiInCooldown();
    const tryGroqFirst =
        AI_PROVIDER === 'groq' && !groqCooldown && Boolean(GROQ_API_KEY);

    if (tryGroqFirst) {
        const response = await fetch(GROQ_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify(buildGroqChatBody(prompt, {
                temperature: 0.4,
                response_format: { type: 'json_object' },
            })),
        });
        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) {
                setAiRateLimitCooldown();
            }
            if (shouldFallbackFromGroq(response.status) && geminiModel) {
                if (response.status === 429) {
                    console.warn('[SubjectPlans] Groq rate-limited; using Gemini for this request.');
                }
                try {
                    const result = await geminiModel.generateContent(prompt);
                    return (await result.response).text();
                } catch (geminiErr) {
                    if (isRateLimitError(geminiErr)) {
                        setAiRateLimitCooldown();
                        throw new Error('AI rate limit reached (429). Try again in a few minutes.');
                    }
                    throw geminiErr;
                }
            }
            if (response.status === 429) {
                throw new Error('AI rate limit reached (429). Try again in a few minutes.');
            }
            throw new Error(`Groq error ${response.status}: ${errText.slice(0, 200)}`);
        }
        const data = await response.json();
        const { content, finishReason } = extractGroqMessageContent(data);
        if (!content && geminiModel) {
            console.warn(`[SubjectPlans] Groq empty content (finish_reason=${finishReason}); using Gemini.`);
            try {
                const result = await geminiModel.generateContent(prompt);
                return (await result.response).text();
            } catch (geminiErr) {
                if (isRateLimitError(geminiErr)) {
                    setAiRateLimitCooldown();
                    throw new Error('AI rate limit reached (429). Try again in a few minutes.');
                }
                throw geminiErr;
            }
        }
        return content || '';
    }

    if (AI_PROVIDER === 'groq' && !GROQ_API_KEY && !geminiModel) {
        throw new Error('Groq API key missing — set VITE_GROQ_API_KEY in .env');
    }

    if (!geminiModel) {
        if (groqCooldown) {
            throw new Error(
                `AI rate limit active — try again in about ${getAiCooldownMinutesLeft()} minutes.`,
            );
        }
        throw new Error('Gemini API key missing — set VITE_GEMINI_API_KEY in .env');
    }
    try {
        const result = await geminiModel.generateContent(prompt);
        return (await result.response).text();
    } catch (geminiErr) {
        if (isRateLimitError(geminiErr)) {
            setAiRateLimitCooldown();
            throw new Error('AI rate limit reached (429). Try again in a few minutes.');
        }
        throw geminiErr;
    }
}

// =====================================================
// Validation & sanitisation
// =====================================================

function validReading(reading, dayNumber) {
    if (!reading || typeof reading !== 'object') return null;
    const day = Number(reading.day) || dayNumber;
    const passages = Array.isArray(reading.passages) ? reading.passages : [];
    const cleanPassages = passages
        .map((p) => {
            const bookId = Number(p?.book_id);
            const chapter = Number(p?.chapter);
            const meta = CANONICAL_BOOKS_BY_ID[bookId];
            if (!meta || chapter < 1 || chapter > meta.chapters) return null;

            const passage = { book_id: bookId, chapter };

            // Optional verse range — used to auto-scroll and highlight the
            // specific passage inside the chapter while still loading the
            // whole chapter for context.
            const verseStart = Number(p?.verse_start);
            const verseEnd = Number(p?.verse_end);
            if (
                Number.isInteger(verseStart) &&
                Number.isInteger(verseEnd) &&
                verseStart >= 1 &&
                verseEnd >= verseStart
            ) {
                passage.verse_start = verseStart;
                passage.verse_end = verseEnd;
            }

            return passage;
        })
        .filter(Boolean);
    if (!cleanPassages.length) return null;

    const questionsEn = Array.isArray(reading.questions_en) ? reading.questions_en.slice(0, 5) : [];
    const questionsAf = Array.isArray(reading.questions_af) ? reading.questions_af.slice(0, 5) : [];

    return {
        day,
        passages: cleanPassages,
        commentary_intro_en: String(reading.commentary_intro_en || '').slice(0, 2500),
        commentary_intro_af: String(reading.commentary_intro_af || '').slice(0, 2500),
        questions_en: questionsEn,
        questions_af: questionsAf,
    };
}

async function sanitisePayload(payload, durationDays, subjectLabel = '', options = {}) {
    const { lenient = false, subjectSlug = '', language = 'en' } = options;
    if (!payload || typeof payload !== 'object') {
        throw new Error('AI response was not an object');
    }

    const readings = [];
    const rawReadings = Array.isArray(payload.readings) ? payload.readings : [];
    for (let i = 0; i < durationDays; i++) {
        const raw = rawReadings[i] || rawReadings.find((r) => Number(r?.day) === i + 1);
        let reading = validReading(raw, i + 1);
        if (!reading) {
            if (lenient) {
                reading = buildFallbackReading(i + 1, subjectSlug, subjectLabel, language);
            } else {
                throw new Error(`AI plan missing valid reading for day ${i + 1}`);
            }
        }
        reading.day = i + 1;
        readings.push(reading);
    }

    const enrichedReadings = await enrichSubjectPlanReadings(readings, {
        subject: subjectLabel,
        durationDays,
    });

    return {
        title_en: String(payload.title_en || '').slice(0, 160).trim(),
        title_af: String(payload.title_af || '').slice(0, 160).trim(),
        description_en: String(payload.description_en || '').slice(0, 600).trim(),
        description_af: String(payload.description_af || '').slice(0, 600).trim(),
        study_guide_en: String(payload.study_guide_en || '').slice(0, 2000).trim(),
        study_guide_af: String(payload.study_guide_af || '').slice(0, 2000).trim(),
        cover_emoji: String(payload.cover_emoji || '📖').slice(0, 8),
        readings: enrichedReadings,
    };
}

function buildSlug(subject) {
    const base = subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'subject';
    const shortId = Math.random().toString(36).slice(2, 8);
    return `subject-${base}-${shortId}`;
}

// =====================================================
// Public API: generate a subject plan
// =====================================================

const ALLOWED_DURATIONS = [3, 7, 14, 30];

/**
 * Generate a brand-new subject plan with AI, persist it, enroll the user.
 *
 * @param {Object} args
 * @param {string} args.subject           Subject text (e.g. "Faith") OR chip.en/af label.
 * @param {string} [args.subjectSlug]     Optional curated chip slug (e.g. "faith").
 * @param {number} args.durationDays      One of ALLOWED_DURATIONS.
 * @param {string} [args.language]        'en' or 'af' (used for default labels only).
 * @returns {Promise<{success: boolean, planSlug?: string, error?: string, requiresAuth?: boolean}>}
 */
/**
 * Generate an AI plan straight into the community pool (no personal copy, no enrollment).
 * Used to backfill "For You" when fewer than FOR_YOU_PLAN_LIMIT plans are available.
 */
export async function generatePoolSubjectPlan({
    subject,
    subjectSlug,
    durationDays,
    language = 'en',
}) {
    return generateSubjectPlan({
        subject,
        subjectSlug,
        durationDays,
        language,
        poolOnly: true,
    });
}

export async function generateSubjectPlan({
    subject,
    subjectSlug,
    durationDays,
    language = 'en',
    autoSource = false,
    shareToPool = false,
    poolOnly = false,
}) {
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: false, requiresAuth: true, error: 'Authentication required' };
        }

        const trimmedSubject = String(subject || '').trim();
        if (!trimmedSubject) {
            return { success: false, error: 'Subject is required' };
        }
        const duration = ALLOWED_DURATIONS.includes(Number(durationDays)) ? Number(durationDays) : 7;

        // Pull the user's prior plans on this subject so we can (a) pick a
        // fresh lens and (b) tell the AI which chapters were already used.
        const subjectKey = subjectSlug || trimmedSubject.toLowerCase();
        const history = await getSubjectPlanHistory(userId, subjectKey);
        const lens = pickNextLens(history.usedLenses);

        logEvent('subject_plan_generation_started', {
            subject: trimmedSubject,
            duration,
            lens: lens?.key,
            prior_plans: history.count,
            avoided_chapters: history.usedChapters.length,
        });

        const prompt = poolOnly
            ? buildPoolBackfillPrompt(trimmedSubject, duration, language, {
                  usedChapters: history.usedChapters,
              })
            : buildPrompt(trimmedSubject, duration, language, {
                  lens,
                  usedChapters: history.usedChapters,
              });
        const raw = await callAi(prompt);
        let parsed;
        try {
            parsed = extractJsonObject(raw);
        } catch (parseErr) {
            if (!poolOnly) throw parseErr;
            parsed = buildSyntheticPoolPayload(trimmedSubject, subjectKey, duration, language);
        }
        const clean = await sanitisePayload(parsed, duration, trimmedSubject, {
            lenient: poolOnly,
            subjectSlug: subjectKey,
            language,
        });

        if (!clean.title_en || !clean.title_af) {
            const fallback = `${trimmedSubject} — ${duration} days`;
            clean.title_en = clean.title_en || fallback;
            clean.title_af = clean.title_af || fallback;
        }
        if (!clean.description_en) {
            clean.description_en = `A ${duration}-day study on ${trimmedSubject} drawn from passages across Scripture.`;
        }
        if (!clean.description_af) {
            clean.description_af = `'n ${duration}-dag studie oor ${trimmedSubject} uit gedeeltes regdeur die Skrif.`;
        }

        const slug = buildSlug(subjectSlug || trimmedSubject);
        const sourcePrefix = poolOnly ? 'ai_foryou_fill' : autoSource ? 'ai_auto' : 'ai_subject_generator';
        const source = lens?.key ? `${sourcePrefix}:${lens.key}` : sourcePrefix;

        const insertRow = {
            slug: poolOnly ? `${slug}-pool-${Date.now().toString(36).slice(-6)}` : slug,
            title_en: clean.title_en,
            title_af: clean.title_af,
            description_en: clean.description_en,
            description_af: clean.description_af,
            study_guide_en: clean.study_guide_en || null,
            study_guide_af: clean.study_guide_af || null,
            duration_days: duration,
            category: 'personal',
            readings: clean.readings,
            cover_emoji: clean.cover_emoji || '📖',
            sort_order: poolOnly ? 9997 : 9999,
            is_active: true,
            is_personal: !poolOnly,
            is_pool: poolOnly,
            created_by_user_id: poolOnly ? null : userId,
            original_owner_id: poolOnly ? userId : null,
            subject: subjectKey,
            source,
            generation_model: AI_PROVIDER === 'groq' ? GROQ_MODEL : GEMINI_MODEL,
        };

        const { data: planRow, error: insertErr } = await supabase
            .from('reading_plans')
            .insert(insertRow)
            .select('id, slug')
            .single();

        if (insertErr) {
            const msg = `${insertErr.message || ''} ${insertErr.details || ''}`.toLowerCase();
            if (
                insertErr.code === '42703' ||
                insertErr.code === 'PGRST204' ||
                msg.includes('is_personal') ||
                msg.includes('is_pool') ||
                (msg.includes('personal') && msg.includes('category'))
            ) {
                throw new Error(
                    poolOnly
                        ? 'Plan pool needs a database update. Run src/sql_imports/plan_pool_migration.sql in Supabase SQL Editor, then try again.'
                        : 'Subject plans need a database update. Run src/sql_imports/subject_plans_migration.sql in Supabase SQL Editor, then try again.',
                );
            }
            throw insertErr;
        }

        if (!poolOnly) {
            const { error: enrollErr } = await supabase
                .from('user_reading_plans')
                .insert({
                    user_id: userId,
                    plan_id: planRow.id,
                    status: 'active',
                    current_day: 1,
                    completed_days: [],
                    started_at: new Date().toISOString(),
                    last_activity_at: new Date().toISOString(),
                });
            if (enrollErr) {
                console.warn('[SubjectPlans] enrollment failed (plan still created):', enrollErr.message);
            }
        }

        let sharedToPool = poolOnly;
        if (!poolOnly && shareToPool) {
            const poolRes = await sharePlanToCommunityPool(planRow.id);
            sharedToPool = poolRes.success;
        }

        logEvent(poolOnly ? 'foryou_pool_plan_generated' : 'subject_plan_generated', {
            subject: trimmedSubject,
            duration,
            plan_slug: planRow.slug,
            shared_to_pool: sharedToPool,
        });

        return { success: true, planSlug: planRow.slug, planId: planRow.id, sharedToPool };
    } catch (err) {
        const logFn = poolOnly ? console.warn : console.error;
        logFn('[SubjectPlans] generateSubjectPlan:', err);
        logEvent('subject_plan_generation_failed', { error: err.message, pool_only: poolOnly });
        return { success: false, error: err.message || 'Failed to generate subject plan' };
    }
}

/**
 * List the user's own AI-generated subject plans (only non-deleted ones).
 * Soft-deleted plans (is_active=false) are excluded — they live on only so
 * `getSubjectPlanHistory` can avoid duplicating their chapters in future plans.
 */
export async function getUserSubjectPlans() {
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: true, data: [] };
        }
        let { data, error } = await supabase
            .from('reading_plans')
            .select('id, slug, title_en, title_af, description_en, description_af, duration_days, cover_emoji, subject, created_at')
            .eq('is_personal', true)
            .eq('created_by_user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) {
            const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
            if (error.code === '42703' || error.code === 'PGRST204' || msg.includes('is_personal')) {
                return { success: true, data: [], migrationPending: true };
            }
            throw error;
        }
        return { success: true, data: data || [] };
    } catch (err) {
        console.error('[SubjectPlans] getUserSubjectPlans:', err);
        return { success: false, data: [], error: err.message };
    }
}

/** Max plans shown in the "For You" section (community pool only). */
export const FOR_YOU_PLAN_LIMIT = 20;

function normalizePlanTitle(plan) {
    return String(plan?.title_en || plan?.title_af || plan?.slug || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * Pick up to `limit` pool plans with varied subjects/titles (not 5× the same topic).
 */
function pickDiversePoolPlans(poolPlans, limit = FOR_YOU_PLAN_LIMIT) {
    const sorted = [...(poolPlans || [])].sort(
        (a, b) =>
            (b.poolScore || 0) - (a.poolScore || 0) ||
            new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );
    const picked = [];
    const subjectsUsed = new Set();
    const titlesUsed = new Set();

    const tryAdd = (plan) => {
        if (picked.length >= limit || picked.some((p) => p.id === plan.id)) return;
        picked.push(plan);
    };

    for (const plan of sorted) {
        const subj = String(plan.subject || plan.slug || 'general').toLowerCase();
        if (subjectsUsed.has(subj)) continue;
        subjectsUsed.add(subj);
        titlesUsed.add(normalizePlanTitle(plan));
        tryAdd(plan);
    }

    for (const plan of sorted) {
        if (picked.length >= limit) break;
        const title = normalizePlanTitle(plan);
        if (titlesUsed.has(title)) continue;
        titlesUsed.add(title);
        tryAdd(plan);
    }

    for (const plan of sorted) {
        if (picked.length >= limit) break;
        tryAdd(plan);
    }

    return picked;
}

function scorePoolPlanForInterests(plan, interestSlugs = []) {
    const subject = String(plan?.subject || '').toLowerCase();
    if (!interestSlugs.length) return 0;
    let score = 0;
    for (const slug of interestSlugs) {
        if (subject === slug) score += 3;
        const chip = SUBJECT_BY_SLUG[slug];
        if (chip?.keywords?.some((kw) => subject.includes(kw))) score += 2;
    }
    return score;
}

/**
 * Shared pool: AI plans another user released. Readable by all authenticated users.
 */
export async function getPoolPlansForUser({
    limit = FOR_YOU_PLAN_LIMIT,
    excludePlanIds = [],
    excludeSlugs = [],
    excludeSubjects = [],
    excludePersonalSlugs = [],
    interestSlugs = [],
} = {}) {
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: true, data: [] };
        }

        let { data, error } = await supabase
            .from('reading_plans')
            .select(
                'id, slug, title_en, title_af, description_en, description_af, duration_days, cover_emoji, subject, source, created_at, is_pool',
            )
            .eq('is_pool', true)
            .eq('is_active', true)
            .neq('original_owner_id', userId)
            .order('created_at', { ascending: false })
            .limit(120);

        if (error) {
            const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
            if (error.code === '42703' || error.code === 'PGRST204' || msg.includes('is_pool')) {
                return { success: true, data: [], migrationPending: true };
            }
            throw error;
        }

        const excludeIdSet = new Set(excludePlanIds);
        const excludeSlugSet = new Set(excludeSlugs);
        const excludeSubjectSet = new Set(
            (excludeSubjects || []).map((s) => String(s || '').toLowerCase()).filter(Boolean),
        );

        const personalSlugPrefixes = (excludePersonalSlugs || []).filter(Boolean);

        const scored = (data || [])
            .filter((p) => {
                if (!p?.slug || excludeIdSet.has(p.id) || excludeSlugSet.has(p.slug)) return false;
                const subj = String(p.subject || '').toLowerCase();
                if (subj && excludeSubjectSet.has(subj)) return false;
                if (personalSlugPrefixes.some((ps) => p.slug.startsWith(`${ps}-pool`))) return false;
                return true;
            })
            .map((p) => ({
                ...p,
                poolScore: scorePoolPlanForInterests(p, interestSlugs),
            }));

        const filtered = pickDiversePoolPlans(scored, limit);

        return { success: true, data: filtered };
    } catch (err) {
        console.warn('[SubjectPlans] getPoolPlansForUser:', err?.message);
        return { success: false, data: [], error: err.message };
    }
}

/**
 * "For You" feed — community pool only (up to FOR_YOU_PLAN_LIMIT diverse plans).
 * Does NOT repeat plans from "Your subject plans" (those are your personal plans).
 */
export async function getForYouPlans({
    language = 'en',
    dismissedSlugs = [],
    enrolledPlanIds = [],
    excludePersonalPlans = [],
} = {}) {
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: true, plans: [], profileHint: '' };
        }

        const dismissed = new Set(dismissedSlugs || []);
        const enrolledIds = new Set(enrolledPlanIds || []);

        let interestSlugs = [];
        try {
            const interest = await analyzeUserInterests(userId);
            if (interest?.success) {
                for (const { topic } of interest.topics || []) {
                    const lower = String(topic || '').toLowerCase();
                    const chip = SUBJECT_CHIPS.find(
                        (c) => c.slug === lower || c.keywords.some((kw) => lower.includes(kw)),
                    );
                    if (chip) interestSlugs.push(chip.slug);
                }
            }
        } catch {}
        interestSlugs = [...new Set(interestSlugs)];

        const personalList =
            excludePersonalPlans.length > 0
                ? excludePersonalPlans
                : (await getUserSubjectPlans()).data || [];

        const excludePlanIds = [...enrolledIds];
        const excludeSlugs = [...dismissed];
        const excludeSubjects = [];

        for (const p of personalList) {
            if (p?.id) excludePlanIds.push(p.id);
            if (p?.slug) {
                excludeSlugs.push(p.slug);
                excludeSlugs.push(`${p.slug}-pool`);
            }
            if (p?.subject) excludeSubjects.push(p.subject);
        }

        const poolRes = await getPoolPlansForUser({
            limit: FOR_YOU_PLAN_LIMIT,
            excludePlanIds,
            excludeSlugs,
            excludeSubjects,
            excludePersonalSlugs: personalList.map((p) => p.slug).filter(Boolean),
            interestSlugs,
        });

        const pool = (poolRes.data || []).filter((p) => p?.slug && !dismissed.has(p.slug));

        const plans = pool.map((plan) => ({
            plan,
            kind: 'pool',
            reasonKey: 'pool',
            reasonLabel: language === 'af' ? 'Van die gemeenskapspoel' : 'From the community pool',
        }));

        const profileHint =
            interestSlugs.length > 0
                ? language === 'af'
                    ? `Tot ${FOR_YOU_PLAN_LIMIT} verskillende planne op jou profiel. Jou planne staan apart onder "Jou onderwerp-planne".`
                    : `Up to ${FOR_YOU_PLAN_LIMIT} different plans matched to your profile. Your own plans live under "Your subject plans".`
                : language === 'af'
                  ? `Tot ${FOR_YOU_PLAN_LIMIT} verskillende gemeenskapplanne om van te kies. Jou eie planne is apart hieronder.`
                  : `Up to ${FOR_YOU_PLAN_LIMIT} varied community plans to choose from. Your own plans are listed separately below.`;

        return { success: true, plans, profileHint, migrationPending: poolRes.migrationPending };
    } catch (err) {
        console.warn('[SubjectPlans] getForYouPlans:', err?.message);
        return { success: false, plans: [], error: err.message };
    }
}

/** Shorter plans for pool backfill — fewer tokens, fewer missing-day failures. */
const BACKFILL_DURATIONS = [3, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
const BACKFILL_DELAY_MS = 5000;
const BACKFILL_MAX_FAILURES = 5;
const BACKFILL_MAX_RATE_LIMITS = 3;
export const FOR_YOU_BACKFILL_SESSION_PREFIX = 'bible_foryou_backfill_attempted_';

export function shouldRunForYouBackfill(userId) {
    if (!userId) return false;
    try {
        return !sessionStorage.getItem(`${FOR_YOU_BACKFILL_SESSION_PREFIX}${userId}`);
    } catch {
        return true;
    }
}

export function markForYouBackfillAttempted(userId) {
    if (!userId) return;
    try {
        sessionStorage.setItem(`${FOR_YOU_BACKFILL_SESSION_PREFIX}${userId}`, '1');
    } catch {}
}

/** Clear session backfill flag so the Plans page can retry pool generation. */
export function clearForYouBackfillSession(userId) {
    if (!userId) return;
    try {
        sessionStorage.removeItem(`${FOR_YOU_BACKFILL_SESSION_PREFIX}${userId}`);
    } catch {}
}

function pickNextBackfillChip({ personalList = [], currentPlans = [], interestSlugs = [], attemptIndex = 0 }) {
    const blockedSubjects = new Set(
        personalList.map((p) => String(p.subject || '').toLowerCase()).filter(Boolean),
    );
    const forYouSubjects = new Set(
        currentPlans.map((p) => String(p.plan?.subject || '').toLowerCase()).filter(Boolean),
    );

    const candidates = [];
    for (const slug of interestSlugs) {
        const chip = SUBJECT_BY_SLUG[slug];
        if (chip && !blockedSubjects.has(chip.slug)) candidates.push(chip);
    }
    for (const chip of SUBJECT_CHIPS) {
        if (!blockedSubjects.has(chip.slug) && !candidates.some((c) => c.slug === chip.slug)) {
            candidates.push(chip);
        }
    }

    if (!candidates.length) {
        return SUBJECT_CHIPS[attemptIndex % SUBJECT_CHIPS.length];
    }

    const fresh = candidates.filter((c) => !forYouSubjects.has(c.slug));
    const pool = fresh.length ? fresh : candidates;
    return pool[attemptIndex % pool.length];
}

/**
 * If "For You" has fewer than FOR_YOU_PLAN_LIMIT plans, generate pool-only AI plans
 * until the feed is full (runs sequentially; use onProgress for UI).
 */
export async function ensureForYouPoolFilled({
    language = 'en',
    dismissedSlugs = [],
    enrolledPlanIds = [],
    excludePersonalPlans = [],
    onProgress,
} = {}) {
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: false, reason: 'guest', generated: 0 };
        }

        let interestSlugs = [];
        try {
            const interest = await analyzeUserInterests(userId);
            if (interest?.success) {
                for (const { topic } of interest.topics || []) {
                    const lower = String(topic || '').toLowerCase();
                    const chip = SUBJECT_CHIPS.find(
                        (c) => c.slug === lower || c.keywords.some((kw) => lower.includes(kw)),
                    );
                    if (chip) interestSlugs.push(chip.slug);
                }
            }
        } catch {}
        interestSlugs = [...new Set(interestSlugs)];

        const baseOpts = {
            language,
            dismissedSlugs,
            enrolledPlanIds,
            excludePersonalPlans,
        };

        if (isAiInCooldown()) {
            const current = await getForYouPlans(baseOpts);
            return {
                success: true,
                generated: 0,
                plans: current.plans,
                count: current.plans?.length || 0,
                rateLimited: true,
                deferred: true,
                cooldownMinutes: getAiCooldownMinutesLeft(),
            };
        }

        let generated = 0;
        let failures = 0;
        let rateLimitHits = 0;
        const maxAttempts = Math.min(6, FOR_YOU_PLAN_LIMIT);

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const current = await getForYouPlans(baseOpts);
            const count = current.plans?.length || 0;

            onProgress?.({ current: count, target: FOR_YOU_PLAN_LIMIT });

            if (count >= FOR_YOU_PLAN_LIMIT) {
                markForYouBackfillAttempted(userId);
                return { success: true, generated, plans: current.plans, count };
            }

            if (failures >= BACKFILL_MAX_FAILURES) {
                markForYouBackfillAttempted(userId);
                return {
                    success: generated > 0,
                    generated,
                    plans: current.plans,
                    error: 'Too many generation failures',
                    rateLimited: rateLimitHits > 0,
                };
            }

            if (rateLimitHits >= BACKFILL_MAX_RATE_LIMITS || isAiInCooldown()) {
                markForYouBackfillAttempted(userId);
                return {
                    success: generated > 0,
                    generated,
                    plans: current.plans,
                    error: 'AI rate limit — try again later',
                    rateLimited: true,
                    cooldownMinutes: getAiCooldownMinutesLeft(),
                };
            }

            if (attempt > 0) {
                await sleep(BACKFILL_DELAY_MS);
            }

            const chip = pickNextBackfillChip({
                personalList: excludePersonalPlans,
                currentPlans: current.plans || [],
                interestSlugs,
                attemptIndex: attempt,
            });
            const duration = BACKFILL_DURATIONS[attempt % BACKFILL_DURATIONS.length];
            const subjectLabel = language === 'af' ? chip.af : chip.en;

            const genRes = await generatePoolSubjectPlan({
                subject: subjectLabel,
                subjectSlug: chip.slug,
                durationDays: duration,
                language,
            });

            if (genRes.success) {
                generated += 1;
                failures = 0;
                rateLimitHits = 0;
            } else {
                failures += 1;
                if (isRateLimitError(genRes.error)) {
                    rateLimitHits += 1;
                    if (isAiInCooldown()) break;
                }
            }
        }

        const final = await getForYouPlans(baseOpts);
        const finalCount = final.plans?.length || 0;
        if (finalCount >= FOR_YOU_PLAN_LIMIT || generated > 0 || rateLimitHits > 0) {
            markForYouBackfillAttempted(userId);
        }
        return {
            success: finalCount > 0,
            generated,
            plans: final.plans,
            count: finalCount,
            rateLimited: rateLimitHits > 0,
        };
    } catch (err) {
        console.warn('[SubjectPlans] ensureForYouPoolFilled:', err?.message);
        return { success: false, generated: 0, error: err.message };
    }
}

// =====================================================
// Auto-generation scheduler (every ~48h on Plans visit)
// =====================================================

const AUTO_PLAN_INTERVAL_MS = 48 * 60 * 60 * 1000; // 2 days
const AUTO_PLAN_MAX_ACTIVE = 5;
const AUTO_PLAN_SUBJECT_COOLDOWN_DAYS = 14;
const AUTO_PLAN_DURATION_CYCLE = [7, 14, 7, 3, 7, 14]; // varies length so it doesn't feel mechanical
const AUTO_PLAN_TOGGLE_KEY = 'bible_auto_plans_enabled';

/**
 * User preference for auto-generation. Default: ON.
 * Stored in localStorage so it survives refresh; can be moved to Supabase
 * user_settings later if desired.
 */
export function getAutoPlanEnabled() {
    try {
        const v = localStorage.getItem(AUTO_PLAN_TOGGLE_KEY);
        if (v === null) return true;
        return v === 'true';
    } catch {
        return true;
    }
}
export function setAutoPlanEnabled(enabled) {
    try {
        localStorage.setItem(AUTO_PLAN_TOGGLE_KEY, enabled ? 'true' : 'false');
    } catch {}
}

/**
 * Inspect the user's auto-generated plan history to decide if it's time to
 * generate another one and how many are currently active.
 *
 * Returns { dueNow, activeCount, lastAutoAt, capReached, subjectsLast14Days }.
 */
async function inspectAutoPlanSchedule(userId) {
    if (!userId || userId.startsWith('user_')) {
        return { dueNow: false, activeCount: 0, lastAutoAt: null, capReached: false, subjectsLast14Days: [] };
    }
    try {
        const { data, error } = await supabase
            .from('reading_plans')
            .select('id, subject, source, created_at, is_active')
            .eq('is_personal', true)
            .eq('created_by_user_id', userId)
            .like('source', 'ai_auto%')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
            if (
                error.code === '42703' ||
                error.code === 'PGRST204' ||
                msg.includes('is_personal') ||
                msg.includes('subject')
            ) {
                return { dueNow: false, activeCount: 0, lastAutoAt: null, capReached: false, subjectsLast14Days: [], migrationPending: true };
            }
            throw error;
        }

        const rows = data || [];
        const activeRows = rows.filter((r) => r.is_active);
        const lastAutoAt = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : null;
        const dueNow = !lastAutoAt || Date.now() - lastAutoAt >= AUTO_PLAN_INTERVAL_MS;

        const cooldownCutoff = Date.now() - AUTO_PLAN_SUBJECT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        const subjectsLast14Days = rows
            .filter((r) => r.created_at && new Date(r.created_at).getTime() >= cooldownCutoff && r.subject)
            .map((r) => String(r.subject).toLowerCase());

        return {
            dueNow,
            activeCount: activeRows.length,
            lastAutoAt,
            capReached: activeRows.length >= AUTO_PLAN_MAX_ACTIVE,
            subjectsLast14Days,
        };
    } catch (err) {
        console.warn('[SubjectPlans] inspectAutoPlanSchedule:', err?.message);
        return { dueNow: false, activeCount: 0, lastAutoAt: null, capReached: false, subjectsLast14Days: [] };
    }
}

/**
 * Smart subject picker for auto-generation.
 *
 * Order of preference:
 *   1. Curated chips matching the user's recent search/AI interests that we
 *      haven't covered in the last 14 days.
 *   2. Curated chips the user has NEVER had a plan on.
 *   3. Curated chips not covered in the last 14 days (will get a fresh lens).
 *   4. Random curated chip (last-resort cycle).
 */
async function pickAutoSubject(userId, recentSubjects) {
    const recent = new Set((recentSubjects || []).map((s) => String(s).toLowerCase()));

    // Interest signals from search_logs / ai_questions
    let interestSlugs = [];
    try {
        const interest = await analyzeUserInterests(userId);
        if (interest?.success) {
            for (const { topic } of interest.topics || []) {
                const lower = String(topic || '').toLowerCase();
                const chip = SUBJECT_CHIPS.find(
                    (c) => c.slug === lower || c.keywords.some((kw) => lower.includes(kw)),
                );
                if (chip) interestSlugs.push(chip.slug);
            }
        }
    } catch {}

    const dedupedInterests = Array.from(new Set(interestSlugs));

    const interestNotRecent = dedupedInterests.find((slug) => !recent.has(slug));
    if (interestNotRecent) return SUBJECT_BY_SLUG[interestNotRecent];

    // All-time subjects this user has had (active or soft-deleted)
    let everSubjects = new Set();
    try {
        const { data } = await supabase
            .from('reading_plans')
            .select('subject')
            .eq('is_personal', true)
            .eq('created_by_user_id', userId);
        for (const row of data || []) {
            if (row?.subject) everSubjects.add(String(row.subject).toLowerCase());
        }
    } catch {}

    const brandNewChip = SUBJECT_CHIPS.find(
        (c) => !everSubjects.has(c.slug) && !recent.has(c.slug),
    );
    if (brandNewChip) return brandNewChip;

    const notRecentChip = SUBJECT_CHIPS.find((c) => !recent.has(c.slug));
    if (notRecentChip) return notRecentChip;

    // Last-resort: deterministic random (so refresh doesn't change pick)
    const idx = Math.floor((Date.now() / 86_400_000) % SUBJECT_CHIPS.length);
    return SUBJECT_CHIPS[idx];
}

/**
 * Try to auto-generate the next plan if scheduling permits.
 *
 * Skips silently if:
 *   - user is a guest
 *   - auto-generation is disabled by user preference
 *   - it has been < AUTO_PLAN_INTERVAL_MS since the last auto plan
 *   - the user already has AUTO_PLAN_MAX_ACTIVE active auto plans
 *   - the DB migration for personal plans has not been applied
 *
 * Returns { generated, plan?, reason? }.
 */
export async function autoGenerateNextPlanIfDue({ language = 'en' } = {}) {
    if (!getAutoPlanEnabled()) {
        return { generated: false, reason: 'disabled' };
    }
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { generated: false, reason: 'guest' };
        }
        // Bail-out flag to avoid duplicate generations in the same browser session
        // (e.g. multiple tabs or quick re-mounts of <ReadingPlans />).
        const sessionFlag = `bible_auto_plan_attempted_${userId}`;
        if (sessionStorage.getItem(sessionFlag)) {
            return { generated: false, reason: 'session_attempted' };
        }

        const schedule = await inspectAutoPlanSchedule(userId);
        if (schedule.migrationPending) return { generated: false, reason: 'migration_pending' };
        if (!schedule.dueNow) return { generated: false, reason: 'not_due', schedule };
        if (schedule.capReached) return { generated: false, reason: 'cap_reached', schedule };

        sessionStorage.setItem(sessionFlag, '1');

        const chip = await pickAutoSubject(userId, schedule.subjectsLast14Days);
        if (!chip) return { generated: false, reason: 'no_subject' };

        // Vary the duration so the cadence doesn't feel mechanical.
        const cycleIdx = (schedule.activeCount + (schedule.subjectsLast14Days?.length || 0)) % AUTO_PLAN_DURATION_CYCLE.length;
        const duration = AUTO_PLAN_DURATION_CYCLE[cycleIdx];

        const result = await generateSubjectPlan({
            subject: language === 'af' ? chip.af : chip.en,
            subjectSlug: chip.slug,
            durationDays: duration,
            language,
            autoSource: true,
        });

        if (result.success) {
            return { generated: true, planSlug: result.planSlug, planId: result.planId, chip };
        }
        return { generated: false, reason: 'generation_failed', error: result.error };
    } catch (err) {
        console.warn('[SubjectPlans] autoGenerateNextPlanIfDue:', err?.message);
        return { generated: false, reason: 'error', error: err.message };
    }
}

// =====================================================
// Delete + history
// =====================================================

/**
 * Copy a plan the user owns into the community pool (separate row).
 * Used after generating a NEW plan on delete — the fresh plan is shared, not the old one.
 */
export async function sharePlanToCommunityPool(planId) {
    if (!planId) return { success: false, error: 'Missing plan id' };
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: false, requiresAuth: true };
        }

        const { data: source, error: fetchErr } = await supabase
            .from('reading_plans')
            .select(
                'id, slug, title_en, title_af, description_en, description_af, study_guide_en, study_guide_af, duration_days, readings, cover_emoji, subject, source, generation_model',
            )
            .eq('id', planId)
            .eq('is_personal', true)
            .eq('created_by_user_id', userId)
            .eq('is_active', true)
            .single();

        if (fetchErr || !source) {
            return { success: false, error: fetchErr?.message || 'Plan not found' };
        }

        const lensKey = String(source.source || '').split(':')[1] || 'shared';
        const poolSlug = `${source.slug}-pool-${Date.now().toString(36).slice(-6)}`;

        const { error: insertErr } = await supabase.from('reading_plans').insert({
            slug: poolSlug,
            title_en: source.title_en,
            title_af: source.title_af,
            description_en: source.description_en,
            description_af: source.description_af,
            study_guide_en: source.study_guide_en,
            study_guide_af: source.study_guide_af,
            duration_days: source.duration_days,
            readings: source.readings,
            cover_emoji: source.cover_emoji || '✨',
            sort_order: 9998,
            is_active: true,
            is_personal: false,
            is_pool: true,
            created_by_user_id: null,
            original_owner_id: userId,
            subject: source.subject,
            source: `ai_pool:${lensKey}`,
            generation_model: source.generation_model,
            category: 'personal',
        });

        if (insertErr) {
            const msg = `${insertErr.message || ''} ${insertErr.details || ''}`.toLowerCase();
            if (insertErr.code === '42703' || insertErr.code === 'PGRST204' || msg.includes('is_pool')) {
                return { success: false, migrationPending: true };
            }
            throw insertErr;
        }

        logEvent('subject_plan_shared_to_pool', { source_plan_id: planId, pool_slug: poolSlug });
        return { success: true, poolSlug };
    } catch (err) {
        console.warn('[SubjectPlans] sharePlanToCommunityPool:', err?.message);
        return { success: false, error: err.message };
    }
}

/**
 * Delete a personal AI plan FOR YOU ONLY (soft-delete). Does NOT share the deleted plan.
 * Call `sharePlanToCommunityPool` on the NEW plan after regenerate if others should see it.
 *
 * Returns { success, subject?, duration_days?, error? }.
 */
export async function deletePersonalPlan(planId) {
    if (!planId) return { success: false, error: 'Missing plan id' };
    try {
        const userId = await getUserId();
        if (!userId || userId.startsWith('user_')) {
            return { success: false, requiresAuth: true, error: 'Authentication required' };
        }

        const { data: planRow, error: fetchErr } = await supabase
            .from('reading_plans')
            .select('id, slug, subject, duration_days, is_personal, created_by_user_id, source')
            .eq('id', planId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!planRow) return { success: false, error: 'Plan not found' };
        if (!planRow.is_personal || planRow.created_by_user_id !== userId) {
            return { success: false, error: 'You can only delete your own personal plans' };
        }

        // Remove the user's enrollment(s) so the plan disappears from the UI.
        const { error: unenrollErr } = await supabase
            .from('user_reading_plans')
            .delete()
            .eq('user_id', userId)
            .eq('plan_id', planId);
        if (unenrollErr) {
            console.warn('[SubjectPlans] deletePersonalPlan unenroll failed:', unenrollErr.message);
        }

        const { error: deactivateErr } = await supabase
            .from('reading_plans')
            .update({ is_active: false })
            .eq('id', planId)
            .eq('created_by_user_id', userId);
        if (deactivateErr) throw deactivateErr;

        logEvent('subject_plan_deleted', { plan_id: planId, plan_slug: planRow.slug });
        return {
            success: true,
            subject: planRow.subject,
            duration_days: planRow.duration_days,
        };
    } catch (err) {
        console.error('[SubjectPlans] deletePersonalPlan:', err);
        return { success: false, error: err.message || 'Failed to delete plan' };
    }
}
