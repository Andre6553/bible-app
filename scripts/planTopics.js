/**
 * Topic pools and weekly plan curation helpers.
 * See PLAN_CURATION.md for editorial policy.
 */

/** Weekly slate: one plan per slot — forces variety across 7 plans. */
export const WEEKLY_SLOTS = [
    {
        id: 'life_issue',
        role: 'Life issue (broad appeal)',
        exampleTopics: [
            'peace-when-anxious',
            'grief-and-comfort',
            'forgiveness-after-hurt',
            'when-god-feels-silent',
            'waiting-on-god',
        ],
    },
    {
        id: 'know_jesus',
        role: 'Know Jesus / Gospel',
        exampleTopics: [
            'i-am-sayings',
            'miracles-that-reveal-christ',
            'cross-and-resurrection',
            'jesus-and-the-outcast',
            'parables-of-the-kingdom',
        ],
    },
    {
        id: 'character',
        role: 'Character study',
        exampleTopics: [
            'david-failure-and-restoration',
            'ruth-loyalty-and-providence',
            'peter-denial-and-restoration',
            'mary-mother-of-jesus',
            'moses-leadership-and-doubt',
        ],
    },
    {
        id: 'book_spotlight',
        role: 'Book or letter spotlight',
        exampleTopics: [
            'jonah-four-days',
            'jude-contend-for-faith',
            'philemon-forgiveness',
            'lamentations-hope-in-ruin',
            'haggai-rebuild-the-temple',
        ],
    },
    {
        id: 'practical_wisdom',
        role: 'Practical wisdom',
        exampleTopics: [
            'money-contentment-and-giving',
            'speech-and-the-tongue',
            'work-rest-and-sabbath',
            'friendship-and-loyalty',
            'decisions-and-guidance',
        ],
    },
    {
        id: 'family_community',
        role: 'Family / community',
        exampleTopics: [
            'marriage-in-scripture',
            'parenting-and-children',
            'one-another-commands',
            'unity-in-the-church',
            'hospitality-and-strangers',
        ],
    },
    {
        id: 'seasonal',
        role: 'Seasonal or timely',
        exampleTopics: [
            'advent-expectation',
            'holy-week-journey',
            'pentecost-and-the-spirit',
            'thanksgiving-and-gratitude',
            'new-year-renewal',
        ],
    },
];

/**
 * Reader-intent categories — use when brainstorming topics.
 * Each entry: slug hint, EN/AF hook, sample outcome.
 */
export const READER_INTENT_POOL = [
    {
        intent: 'suffering',
        hooks: {
            en: 'When life hurts — what Scripture records about God in pain',
            af: 'Wanneer lewe seermaak — wat die Skrif oor God in pyn neersluit',
        },
        outcome: {
            en: 'Understand how biblical voices lament, protest, and still trust — from the text.',
            af: 'Verstaan hoe Bybelse stemme kla, proteseer en steeds vertrou — uit die teks.',
        },
    },
    {
        intent: 'anxiety',
        hooks: {
            en: 'Fear and worry — passages that define trust in context',
            af: 'Angs en kommer — gedeeltes wat vertroue in konteks definieer',
        },
        outcome: {
            en: 'See what “do not fear” means in each story’s situation, not as isolated slogans.',
            af: 'Sien wat “moenie vrees nie” in elke storie se situasie beteken, nie as los slagspreuke nie.',
        },
    },
    {
        intent: 'identity',
        hooks: {
            en: 'Who you are before God — creation, fall, redemption',
            af: 'Wie jy is voor God — skepping, val, verlossing',
        },
        outcome: {
            en: 'Trace how Scripture describes human dignity and new life in Christ.',
            af: 'Volg hoe die Skrif menslike waardigheid en nuwe lewe in Christus beskryf.',
        },
    },
    {
        intent: 'forgiveness',
        hooks: {
            en: 'Guilt, grace, and a path forward',
            af: 'Skuld, genade en \'n pad vorentoe',
        },
        outcome: {
            en: 'Learn what repentance and forgiveness look like in narrative and epistle.',
            af: 'Leer hoe berou en vergifnis in verhaal en brief lyk.',
        },
    },
    {
        intent: 'purpose',
        hooks: {
            en: 'Calling when you feel stuck or small',
            af: 'Roeping wanneer jy vas of klein voel',
        },
        outcome: {
            en: 'Follow how God used ordinary people in specific stories — without adding modern career advice.',
            af: 'Volg hoe God gewone mense in spesifieke verhale gebruik het — sonder moderne loopbaanadvies.',
        },
    },
    {
        intent: 'prayer',
        hooks: {
            en: 'How biblical people spoke to God — and listened',
            af: 'Hoe Bybelse mense met God gepraat het — en geluister het',
        },
        outcome: {
            en: 'Study prayers of praise, complaint, intercession, and silence in Scripture.',
            af: 'Bestudeer gebede van lof, klagte, tussenkomste en stilte in die Skrif.',
        },
    },
    {
        intent: 'know_jesus',
        hooks: {
            en: 'Meet Jesus in the Gospels — who He is and what He came to do',
            af: 'Ontmoet Jesus in die Evangelies — wie Hy is en waarom Hy gekom het',
        },
        outcome: {
            en: 'See patterns in Jesus’ words, signs, and passion across Gospel accounts.',
            af: 'Sien patrone in Jesus se woorde, tekens en lyding oor Evangelie-verhale.',
        },
    },
    {
        intent: 'beginner',
        hooks: {
            en: 'Start here — the Bible’s big story in short steps',
            af: 'Begin hier — die Bybel se groot storie in kort stappe',
        },
        outcome: {
            en: 'Grasp creation, covenant, Messiah, and church as one unfolding story.',
            af: 'Begryp skepping, verbond, Messias en kerk as een ontvouende storie.',
        },
    },
];

/** Patterns that fail curation review — block in publish script. */
export const REJECTED_TOPIC_PATTERNS = [
    /^random-verses/i,
    /^misc-/i,
    /verses-about-\w+$/i, // e.g. "verses-about-love" without arc
    /^test-/i,
];

/** Minimum fields for a weekly plan meta object (curated_plans or week folder). */
export const REQUIRED_PLAN_META = [
    'slug',
    'title_en',
    'title_af',
    'description_en',
    'description_af',
    'duration_days',
    'category',
    'learning_outcome_en',
    'learning_outcome_af',
    'weekly_slot',
];

/**
 * Validate plan metadata before seed generation.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlanMeta(meta) {
    const errors = [];

    for (const field of REQUIRED_PLAN_META) {
        if (!meta[field] || String(meta[field]).trim() === '') {
            errors.push(`Missing required field: ${field}`);
        }
    }

    if (meta.slug && REJECTED_TOPIC_PATTERNS.some((re) => re.test(meta.slug))) {
        errors.push(`Slug "${meta.slug}" matches a rejected pattern — choose a journey-based topic.`);
    }

    const validSlots = WEEKLY_SLOTS.map((s) => s.id);
    if (meta.weekly_slot && !validSlots.includes(meta.weekly_slot)) {
        errors.push(`weekly_slot must be one of: ${validSlots.join(', ')}`);
    }

    if (meta.description_en && meta.description_en.length < 80) {
        errors.push('description_en too short — explain reader need and outcome (see PLAN_CURATION.md).');
    }

    if (meta.description_af && meta.description_af.length < 80) {
        errors.push('description_af too short — explain reader need and outcome (see PLAN_CURATION.md).');
    }

    if (meta.duration_days && (meta.duration_days < 3 || meta.duration_days > 52)) {
        errors.push('duration_days should be between 3 and 52 for weekly themed plans.');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a week folder has 7 plans with unique slots.
 * @param {Array<{ weekly_slot: string, slug: string }>} plans
 */
export function validateWeeklySlate(plans) {
    const errors = [];

    if (!Array.isArray(plans) || plans.length !== 7) {
        errors.push(`Weekly slate must have exactly 7 plans; got ${plans?.length ?? 0}.`);
        return { valid: false, errors };
    }

    const slots = plans.map((p) => p.weekly_slot);
    const slugs = plans.map((p) => p.slug);
    const uniqueSlots = new Set(slots);
    const uniqueSlugs = new Set(slugs);

    if (uniqueSlots.size !== 7) {
        errors.push('Each weekly plan must use a distinct weekly_slot (see WEEKLY_SLOTS).');
    }

    if (uniqueSlugs.size !== 7) {
        errors.push('Duplicate slugs in weekly slate.');
    }

    for (const plan of plans) {
        const result = validatePlanMeta(plan);
        errors.push(...result.errors.map((e) => `${plan.slug || 'unknown'}: ${e}`));
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Build ISO week id for catalog tagging, e.g. 2026-W21
 */
export function getIsoWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
