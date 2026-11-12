export const DELETION_LEASE_MS = 15 * 60 * 1000;

export const USER_DATA_TABLES = [
    'verse_notes',
    'verse_highlights',
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
    'user_activity_logs',
    'bible_reading_logs',
    'blog_views',
    'user_trivia_history',
    'user_trivia_daily',
    'api_usage_logs',
    'payment_orders',
    'guest_migration_conflicts',
    'legacy_guest_migration_claims',
    'user_profiles',
];

export function isAuthUserAlreadyGone(error) {
    const msg = String(error?.message || error || '').toLowerCase();
    const status = error?.status || error?.code;
    return (
        status === 'user_not_found' ||
        /^user not found\.?$/.test(msg.trim()) ||
        msg.includes('already been deleted')
    );
}

export function canCompleteDeletion({ tableErrors, remainingCounts, authDeleteError }) {
    if (tableErrors && tableErrors.length) return false;
    if (remainingCounts) {
        for (const n of Object.values(remainingCounts)) {
            if (Number(n) > 0) return false;
        }
    }
    if (authDeleteError && !isAuthUserAlreadyGone(authDeleteError)) return false;
    return true;
}

export function isLeaseExpired(row, now = Date.now()) {
    if (!row) return true;
    if (row.status === 'pending') return true;
    if (row.status !== 'processing') return false;
    const lease = row.lease_until ? Date.parse(row.lease_until) : 0;
    return !lease || lease < now;
}
