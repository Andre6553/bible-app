import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';
import { analyzeUserInterests } from './blogService';

/** See scripts/PLAN_INTELLIGENCE.md */
export const BLEND_WEIGHTS = {
    personal: 0.4,
    editorial: 0.3,
    discovery: 0.3,
};

const PROFILE_VERSION = 1;
const MAX_RECENT_EVENTS = 50;
const SEARCH_SYNC_HOURS = 24;

const INTENT_KEYWORDS = {
    suffering: ['suffer', 'pain', 'grief', 'lament', 'job', 'lyding', 'smart', 'verdriet'],
    anxiety: ['anxiety', 'fear', 'worry', 'peace', 'angst', 'vrees', 'kommer', 'vrede'],
    identity: ['identity', 'who am i', 'worth', 'image of god', 'identiteit', 'waarde'],
    forgiveness: ['forgive', 'forgiveness', 'guilt', 'vergewe', 'vergifnis', 'skuld'],
    purpose: ['purpose', 'calling', 'will of god', 'doel', 'roeping'],
    prayer: ['prayer', 'pray', 'gebed', 'bid'],
    know_jesus: ['jesus', 'christ', 'gospel', 'messiah', 'evangelie'],
    beginner: ['begin', 'start', 'overview', 'begin', 'oorsig'],
    family: ['family', 'marriage', 'parent', 'children', 'familie', 'huwelik', 'gesin'],
    faith: ['faith', 'believe', 'trust', 'geloof', 'vertrou'],
    hope: ['hope', 'hoop'],
    wisdom: ['wisdom', 'proverb', 'wise', 'wysheid', 'spreuke'],
    love: ['love', 'liefde'],
    strength: ['strength', 'courage', 'strong', 'sterkte', 'moed'],
};

const CATEGORY_INTENTS = {
    devotional: ['prayer', 'wisdom', 'peace', 'faith'],
    topic: ['know_jesus', 'purpose', 'family', 'faith'],
    nt: ['know_jesus', 'faith', 'forgiveness'],
    whole_bible: ['beginner', 'purpose', 'faith'],
};

const EVENT_WEIGHTS = {
    plan_completed: 8,
    plan_enrolled: 6,
    plan_day_complete: 3,
    plan_viewed: 1,
    plan_catalog_click: 1,
    plan_paused: 0,
    plan_abandoned: -2,
};

const REASON_LABELS = {
    personal: { en: 'Based on your study interests', af: 'Gebaseer op jou studiebelangstellings' },
    editorial: { en: 'Curated for you', af: 'Uitgesoek vir jou' },
    discovery: { en: 'Explore something new', af: 'Verken iets nuuts' },
};

async function isAuthenticatedUser() {
    const userId = await getUserId();
    return userId && !userId.startsWith('user_');
}

function emptyProfile() {
    return {
        version: PROFILE_VERSION,
        intent_scores: {},
        category_scores: {},
        duration_affinity: { short: 0, medium: 0, long: 0 },
        plans_started: 0,
        plans_completed: 0,
        top_intents: [],
        recent_events: [],
        search_synced_at: null,
        event_count: 0,
    };
}

function durationBucket(days) {
    if (days <= 14) return 'short';
    if (days <= 30) return 'medium';
    return 'long';
}

function normalizeText(...parts) {
    return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Map a catalog plan to intent keys from slug, titles, descriptions, category. */
export function extractPlanIntents(plan, language = 'en') {
    const text = normalizeText(
        plan.slug,
        plan.title_en,
        plan.title_af,
        plan.description_en,
        plan.description_af,
        plan.category
    );

    const intents = new Set(CATEGORY_INTENTS[plan.category] || []);

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
        if (keywords.some((kw) => text.includes(kw))) {
            intents.add(intent);
        }
    }

    return [...intents];
}

function bumpScore(scores, key, amount) {
    if (!key) return;
    scores[key] = (scores[key] || 0) + amount;
}

function applyEventToProfile(profile, eventType, plan) {
    const weight = EVENT_WEIGHTS[eventType] ?? 0;
    if (weight === 0 && eventType !== 'plan_paused') return profile;

    const intents = plan ? extractPlanIntents(plan) : [];
    const next = { ...profile, intent_scores: { ...profile.intent_scores } };
    next.category_scores = { ...profile.category_scores };
    next.duration_affinity = { ...profile.duration_affinity };

    if (plan?.category) {
        bumpScore(next.category_scores, plan.category, Math.max(weight, 1));
    }

    if (plan?.duration_days) {
        bumpScore(next.duration_affinity, durationBucket(plan.duration_days), Math.max(weight, 1));
    }

    for (const intent of intents) {
        bumpScore(next.intent_scores, intent, weight);
    }

    if (eventType === 'plan_enrolled') next.plans_started = (next.plans_started || 0) + 1;
    if (eventType === 'plan_completed') next.plans_completed = (next.plans_completed || 0) + 1;

    next.event_count = (next.event_count || 0) + 1;
    return recomputeTopIntents(next);
}

function recomputeTopIntents(profile) {
    const top = Object.entries(profile.intent_scores || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k]) => k);
    return { ...profile, top_intents: top };
}

function mergeSearchTopics(profile, topics) {
    const next = { ...profile, intent_scores: { ...profile.intent_scores } };
    for (const { topic, weight } of topics || []) {
        const key = topic.toLowerCase();
        if (INTENT_KEYWORDS[key] || key.length > 2) {
            bumpScore(next.intent_scores, key, Math.min(weight, 5));
        }
    }
    next.search_synced_at = new Date().toISOString();
    return recomputeTopIntents(next);
}

function bootstrapFromEnrollments(profile, userPlans) {
    let next = { ...profile };
    for (const enrollment of userPlans || []) {
        const plan = enrollment.reading_plans;
        if (!plan) continue;
        if (enrollment.status === 'completed') {
            next = applyEventToProfile(next, 'plan_completed', plan);
        } else if (enrollment.status === 'active' || enrollment.status === 'paused') {
            next = applyEventToProfile(next, 'plan_enrolled', plan);
            const days = enrollment.completed_days?.length || 0;
            for (let i = 0; i < Math.min(days, 5); i++) {
                next = applyEventToProfile(next, 'plan_day_complete', plan);
            }
        } else if (enrollment.status === 'abandoned') {
            next = applyEventToProfile(next, 'plan_abandoned', plan);
        }
    }
    return next;
}

async function loadProfileFromSettings(userId) {
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', `plan_intel_profile_${userId}`)
            .maybeSingle();
        if (!data?.value) return null;
        return JSON.parse(data.value);
    } catch {
        return null;
    }
}

async function saveProfileToSettings(userId, profile) {
    try {
        await supabase.from('app_settings').upsert({
            key: `plan_intel_profile_${userId}`,
            value: JSON.stringify(profile),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
        return true;
    } catch {
        return false;
    }
}

export async function getUserPlanProfile(userPlans = []) {
    const authed = await isAuthenticatedUser();
    if (!authed) return { success: true, profile: emptyProfile(), isGuest: true };

    const userId = await getUserId();
    let profile = (await loadProfileFromSettings(userId)) || emptyProfile();

    if ((profile.event_count || 0) < 2 && userPlans.length > 0) {
        profile = bootstrapFromEnrollments(profile, userPlans);
    }

    const staleSearch = !profile.search_synced_at
        || (Date.now() - new Date(profile.search_synced_at).getTime()) > SEARCH_SYNC_HOURS * 3600000;

    if (staleSearch) {
        const searchRes = await analyzeUserInterests(userId);
        if (searchRes.success && searchRes.topics?.length) {
            profile = mergeSearchTopics(profile, searchRes.topics);
            await persistProfile(userId, profile);
        }
    }

    return { success: true, profile, isGuest: false };
}

async function persistProfile(userId, profile) {
    await saveProfileToSettings(userId, profile);
}

/**
 * Record user plan behavior and update learned profile.
 */
export async function recordPlanBehavior(eventType, plan, metadata = {}) {
    const authed = await isAuthenticatedUser();
    if (!authed || !plan) return { success: false };

    const userId = await getUserId();
    let profile = (await loadProfileFromSettings(userId)) || emptyProfile();

    profile = applyEventToProfile(profile, eventType, plan);
    profile.recent_events = [
        { eventType, planSlug: plan.slug, at: new Date().toISOString(), ...metadata },
        ...(profile.recent_events || []),
    ].slice(0, MAX_RECENT_EVENTS);

    await persistProfile(userId, profile);

    return { success: true, profile };
}

function personalWeightMultiplier(profile) {
    const events = profile.event_count || 0;
    if (events >= 10) return 1;
    if (events >= 3) return 0.7;
    if (events >= 1) return 0.4;
    return 0.15;
}

function scorePersonal(plan, profile) {
    const intents = extractPlanIntents(plan);
    let score = 0;
    for (const intent of intents) {
        score += profile.intent_scores?.[intent] || 0;
    }
    score += (profile.category_scores?.[plan.category] || 0) * 1.5;
    const bucket = durationBucket(plan.duration_days || 14);
    score += (profile.duration_affinity?.[bucket] || 0) * 0.5;
    return score;
}

function scoreEditorial(plan, catalogLength) {
    const sort = plan.sort_order ?? catalogLength;
    return Math.max(0, catalogLength - sort + 1);
}

function scoreDiscovery(plan, profile) {
    const catScore = profile.category_scores?.[plan.category] || 0;
    const intents = extractPlanIntents(plan);
    const intentSum = intents.reduce((s, i) => s + (profile.intent_scores?.[i] || 0), 0);
    return Math.max(0, 20 - catScore - intentSum * 0.5);
}

function pickReason(personal, editorial, discovery) {
    const max = Math.max(personal, editorial, discovery);
    if (max === personal) return 'personal';
    if (max === discovery) return 'discovery';
    return 'editorial';
}

/**
 * Blended recommendations — not personalization alone.
 */
export function rankPlansForUser(catalog, profile, options = {}) {
    const {
        excludePlanIds = new Set(),
        limit = 5,
        language = 'en',
    } = options;

    const catalogLength = catalog.length || 1;
    const personalMult = personalWeightMultiplier(profile);

    const weights = {
        personal: BLEND_WEIGHTS.personal * personalMult,
        editorial: BLEND_WEIGHTS.editorial + (1 - personalMult) * 0.15,
        discovery: BLEND_WEIGHTS.discovery + (1 - personalMult) * 0.05,
    };

    const totalW = weights.personal + weights.editorial + weights.discovery;
    const norm = {
        personal: weights.personal / totalW,
        editorial: weights.editorial / totalW,
        discovery: weights.discovery / totalW,
    };

    const scored = catalog
        .filter((p) => !excludePlanIds.has(p.id))
        .map((plan) => {
            const pPersonal = scorePersonal(plan, profile);
            const pEditorial = scoreEditorial(plan, catalogLength);
            const pDiscovery = scoreDiscovery(plan, profile);
            const total =
                pPersonal * norm.personal +
                pEditorial * norm.editorial +
                pDiscovery * norm.discovery;
            const reasonKey = pickReason(
                pPersonal * norm.personal,
                pEditorial * norm.editorial,
                pDiscovery * norm.discovery
            );
            return {
                plan,
                score: total,
                reasonKey,
                reasonLabel: REASON_LABELS[reasonKey][language] || REASON_LABELS[reasonKey].en,
            };
        })
        .sort((a, b) => b.score - a.score);

    const picked = [];
    const usedCategories = new Set();

    for (const item of scored) {
        if (picked.length >= limit) break;
        const cat = item.plan.category;
        if (picked.length >= 2 && usedCategories.has(cat) && picked.length < limit - 1) {
            continue;
        }
        picked.push(item);
        usedCategories.add(cat);
    }

    while (picked.length < limit && picked.length < scored.length) {
        const next = scored.find((s) => !picked.includes(s));
        if (!next) break;
        picked.push(next);
    }

    return picked;
}

export async function getPlanRecommendations(catalog, userPlans = [], language = 'en') {
    const { profile, isGuest } = await getUserPlanProfile(userPlans);

    const activeIds = new Set(
        userPlans
            .filter((p) => p.status === 'active' || p.status === 'paused')
            .map((p) => p.plan_id)
    );

    const recommendations = rankPlansForUser(catalog, profile, {
        excludePlanIds: activeIds,
        limit: 5,
        language,
    });

    return {
        success: true,
        recommendations,
        profile,
        isGuest,
        topIntents: profile.top_intents || [],
    };
}

export function getProfileSummary(profile, language = 'en') {
    const intents = profile?.top_intents?.slice(0, 3) || [];
    if (!intents.length) {
        return language === 'af'
            ? 'Ons leer van jou plankeuses en soektogte om beter voorstelle te maak.'
            : 'We learn from your plan choices and searches to suggest better fits over time.';
    }
    const list = intents.join(', ');
    return language === 'af'
        ? `Jou studieprofiel neig na: ${list}. Voorstelle meng dit met nuwe ontdekkinge.`
        : `Your study profile leans toward: ${list}. Suggestions blend this with new discoveries.`;
}
