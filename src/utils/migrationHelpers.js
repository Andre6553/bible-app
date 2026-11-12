export const GUEST_ID_KEY = 'bible_user_id';
export const MIGRATION_STATE_KEY = 'omni_migration_v1';
export const GUEST_NOTE_SEPARATOR = '\n\n--- From guest device ---\n';

export const TABLES_TO_MIGRATE = [
    'verse_highlights',
    'verse_notes',
    'study_collections',
    'highlight_categories',
    'user_labels',
    'word_studies',
    'inductive_studies',
    'search_logs',
    'ai_questions',
    'devotional_history',
    'sermons',
    'user_settings',
    'user_reading_plans',
    'user_plan_events',
    'user_plan_profiles',
];

/** Guest ids are created as user_<rand><time>, never an auth UUID. */
export function isGuestUserId(id) {
    return typeof id === 'string' && /^user_[a-z0-9]+$/i.test(id);
}

export function classifyTableCheck({ error, count }) {
    if (error) return { status: 'failed', count: 0, error: error.message || String(error) };
    const n = Number(count) || 0;
    if (n > 0) return { status: 'found', count: n };
    return { status: 'empty', count: 0 };
}

export function summarizeInspection(tableResults) {
    const tables = tableResults || {};
    const values = TABLES_TO_MIGRATE.map((table) => tables[table] || { status: 'failed' });
    const needed = values.some((t) => t.status === 'found');
    const uncertain = values.some((t) => !['found', 'empty'].includes(t.status));
    const confirmedEmpty = values.length > 0 && values.every((t) => t.status === 'empty');
    return { needed, uncertain, confirmedEmpty };
}

/** Guest id may be retired only when every table is confirmed empty or fully migrated. */
export function shouldRetireGuestId({ confirmedEmpty, allTablesOk, uncertain }) {
    if (uncertain) return false;
    return Boolean(confirmedEmpty || allTablesOk);
}

export function mergeConflictingText(dest, guest) {
    const a = (dest || '').trim();
    const b = (guest || '').trim();
    if (!b) return a;
    if (!a) return b;
    if (a === b) return a;
    if (a.includes(b)) return a;
    return `${a}${GUEST_NOTE_SEPARATOR}${b}`;
}

export function mergeCompletedDays(destDays, guestDays, durationDays) {
    const cap = Number(durationDays) > 0 ? Number(durationDays) : Infinity;
    const merged = [...new Set([...(destDays || []), ...(guestDays || [])])]
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= cap)
        .sort((x, y) => x - y);
    return merged;
}

export function mergeDayNotes(destNotes, guestNotes) {
    const dest = { ...(destNotes || {}) };
    for (const [key, value] of Object.entries(guestNotes || {})) {
        dest[key] = mergeConflictingText(dest[key], value);
    }
    return dest;
}
