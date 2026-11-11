/**
 * Client-side browse filters for the Plans catalog (no DB migration).
 * Topics align with planIntelligenceService intent keys where possible.
 */

export const PLAN_CATEGORIES = [
    { id: 'all', en: 'All', af: 'Alles' },
    { id: 'topic', en: 'Themed', af: 'Temas' },
    { id: 'devotional', en: 'Devotional', af: 'Toewyding' },
    { id: 'nt', en: 'New Testament', af: 'Nuwe Testament' },
    { id: 'whole_bible', en: 'Whole Bible', af: 'Hele Bybel' },
];

export const PLAN_DURATIONS = [
    { id: 'all', en: 'Any length', af: 'Enige lengte' },
    { id: 'short', en: 'Short (1–14)', af: 'Kort (1–14)' },
    { id: 'medium', en: 'Medium (15–30)', af: 'Medium (15–30)' },
    { id: 'long', en: 'Long (31+)', af: 'Lang (31+)' },
];

export const PLAN_TOPICS = [
    { id: 'all', en: 'All topics', af: 'Alle temas' },
    { id: 'beginner', en: 'Beginners', af: 'Beginners' },
    { id: 'know_jesus', en: 'Jesus & Gospels', af: 'Jesus & Evangelies' },
    { id: 'faith', en: 'Faith & hope', af: 'Geloof & hoop' },
    { id: 'family', en: 'Family', af: 'Gesin' },
    { id: 'wisdom', en: 'Wisdom', af: 'Wysheid' },
    { id: 'prayer', en: 'Prayer & Psalms', af: 'Gebed & Psalms' },
    { id: 'anxiety', en: 'Peace & trust', af: 'Vrede & vertroue' },
    { id: 'book_study', en: 'One book', af: 'Een boek' },
];

const SLUG_TOPICS = {
    'beginner-14': ['beginner'],
    'miracles-14': ['know_jesus'],
    'parables-20': ['know_jesus'],
    'faith-hope-21': ['faith'],
    'gospels-40': ['know_jesus'],
    'john-21': ['know_jesus'],
    'women-bible-30': ['know_jesus', 'faith'],
    'family-52': ['family'],
    'proverbs-31': ['wisdom'],
    'psalms-30': ['prayer'],
    'paul-30': ['book_study', 'faith'],
    'romans-16': ['book_study', 'faith'],
    'revelation-22': ['book_study', 'faith'],
    'nt-90': ['book_study'],
    'bible-365': ['beginner'],
    'ot-180': ['book_study'],
    'jonah-4': ['know_jesus', 'faith'],
    'ruth-4': ['faith', 'family'],
    'esther-10': ['faith'],
    'philemon-1': ['faith', 'family', 'book_study'],
    'jude-1': ['faith', 'book_study'],
    'galatians-6': ['faith', 'book_study'],
    'ephesians-6': ['faith', 'family', 'book_study'],
    'philippians-4': ['faith', 'anxiety', 'book_study'],
    'colossians-4': ['faith', 'know_jesus', 'book_study'],
    'james-5': ['wisdom', 'faith', 'book_study'],
    'hebrews-13': ['faith', 'know_jesus', 'book_study'],
    'daniel-12': ['faith', 'book_study'],
    'ecclesiastes-12': ['wisdom', 'book_study'],
    'acts-28': ['know_jesus', 'book_study'],
};

const TOPIC_KEYWORDS = {
    beginner: ['beginner', 'start', 'overview', 'begin', 'oorsig', 'essential'],
    know_jesus: ['jesus', 'gospel', 'evangel', 'miracle', 'parable', 'christ', 'johannes', 'matteus'],
    faith: ['faith', 'hope', 'geloof', 'hoop', 'trust', 'vertrou'],
    family: ['family', 'gesin', 'marriage', 'parent', 'huwelik'],
    wisdom: ['proverb', 'spreuk', 'wisdom', 'wysheid', 'practical'],
    prayer: ['psalm', 'prayer', 'gebed', 'lament', 'praise'],
    anxiety: ['peace', 'fear', 'worry', 'vrede', 'angst', 'trust'],
    book_study: ['chapter', 'letter', 'book', 'hoofstuk', 'brief'],
};

function durationBucket(days) {
    if (days <= 14) return 'short';
    if (days <= 30) return 'medium';
    return 'long';
}

export function inferPlanTopics(plan) {
    const fromSlug = SLUG_TOPICS[plan.slug];
    if (fromSlug?.length) return [...new Set(fromSlug)];

    const blob = [
        plan.slug,
        plan.title_en,
        plan.title_af,
        plan.description_en,
        plan.description_af,
        plan.category,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const found = new Set();
    for (const [topicId, words] of Object.entries(TOPIC_KEYWORDS)) {
        if (words.some((w) => blob.includes(w))) found.add(topicId);
    }

    if (plan.category === 'nt' && plan.duration_days <= 30) found.add('book_study');
    if (plan.category === 'topic') found.add('know_jesus');

    return [...found];
}

export function matchesPlanBrowseFilters(plan, { search, category, duration, topic }, isAf = false) {
    if (category !== 'all' && plan.category !== category) return false;

    const bucket = durationBucket(plan.duration_days || 0);
    if (duration !== 'all' && bucket !== duration) return false;

    if (topic !== 'all') {
        const topics = inferPlanTopics(plan);
        if (!topics.includes(topic)) return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;

    const haystack = isAf
        ? `${plan.title_af} ${plan.description_af} ${plan.slug}`.toLowerCase()
        : `${plan.title_en} ${plan.description_en} ${plan.slug}`.toLowerCase();

    return haystack.includes(q);
}

export function sortPlansForBrowse(plans) {
    return [...plans].sort((a, b) => {
        const orderA = a.sort_order ?? 999;
        const orderB = b.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.duration_days || 0) - (b.duration_days || 0);
    });
}
