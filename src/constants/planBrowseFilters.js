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

/** Tappable topic tiles on the Plans page (no search). */
export const PLAN_TOPIC_TILES = [
    {
        id: 'beginner',
        emoji: '🌱',
        en: 'New to the Bible',
        af: 'Nuut by die Bybel',
        hint_en: 'Short overviews and where to start',
        hint_af: 'Kort oorsigte en waar om te begin',
    },
    {
        id: 'know_jesus',
        emoji: '✝️',
        en: 'Jesus & the Gospels',
        af: 'Jesus & die Evangelies',
        hint_en: 'Gospels, miracles, parables, Acts',
        hint_af: 'Evangelies, wonderwerke, gelykenisse, Handelinge',
    },
    {
        id: 'faith',
        emoji: '🕊️',
        en: 'Faith & hope',
        af: 'Geloof & hoop',
        hint_en: 'Trusting God when life is hard',
        hint_af: 'Vertrou op God wanneer lewe swaar is',
    },
    {
        id: 'family',
        emoji: '👨‍👩‍👧‍👦',
        en: 'Family & home',
        af: 'Gesin & huis',
        hint_en: 'Marriage, parenting, devotion together',
        hint_af: 'Huwelik, opvoed, toewyding saam',
    },
    {
        id: 'wisdom',
        emoji: '📜',
        en: 'Wisdom for life',
        af: 'Wysheid vir die lewe',
        hint_en: 'Proverbs, James, practical choices',
        hint_af: 'Spreuke, Jakobus, praktiese keuses',
    },
    {
        id: 'prayer',
        emoji: '🎵',
        en: 'Prayer & Psalms',
        af: 'Gebed & Psalms',
        hint_en: 'Praise, lament, and talking with God',
        hint_af: 'Lof, klagte en praat met God',
    },
    {
        id: 'anxiety',
        emoji: '🌊',
        en: 'Peace & trust',
        af: 'Vrede & vertroue',
        hint_en: 'When worry or fear feels heavy',
        hint_af: 'Wanneer angst of vrees swaar voel',
    },
    {
        id: 'book_study',
        emoji: '📖',
        en: 'One book at a time',
        af: 'Een boek op ’n slag',
        hint_en: 'Letters and short books, chapter by chapter',
        hint_af: 'Briewe en kort boeke, hoofstuk vir hoofstuk',
    },
    {
        id: 'cat_nt',
        category: 'nt',
        emoji: '✉️',
        en: 'New Testament',
        af: 'Nuwe Testament',
        hint_en: 'NT letters and structured NT reading',
        hint_af: 'NT-briewe en gestruktureerde NT-lees',
    },
    {
        id: 'cat_devotional',
        category: 'devotional',
        emoji: '🕯️',
        en: 'Daily devotion',
        af: 'Daaglikse toewyding',
        hint_en: 'Psalms, Proverbs, family rhythm',
        hint_af: 'Psalms, Spreuke, gesinsritme',
    },
    {
        id: 'cat_whole_bible',
        category: 'whole_bible',
        emoji: '📚',
        en: 'Whole Bible journeys',
        af: 'Hele Bybel-reise',
        hint_en: 'Year-long or OT/NT reading tracks',
        hint_af: 'Jaar-lange of OT/NT-leesroetes',
    },
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

export function planMatchesTopicTile(plan, tile) {
    if (!plan || !tile) return false;
    if (tile.category) {
        return plan.category === tile.category;
    }
    return inferPlanTopics(plan).includes(tile.id);
}

export function getPlansForTopicTile(catalog, tile, { excludeIds = null } = {}) {
    const exclude = excludeIds || new Set();
    return sortPlansForBrowse(
        catalog.filter((plan) => !exclude.has(plan.id) && planMatchesTopicTile(plan, tile))
    );
}

export function countPlansPerTopicTile(catalog, excludeIds = null) {
    const counts = {};
    for (const tile of PLAN_TOPIC_TILES) {
        counts[tile.id] = getPlansForTopicTile(catalog, tile, { excludeIds }).length;
    }
    return counts;
}

export function getTopicTileById(id) {
    return PLAN_TOPIC_TILES.find((t) => t.id === id) || null;
}
