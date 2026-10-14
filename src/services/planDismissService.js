const DISMISSED_PLANS_KEY = 'bible_dismissed_plan_slugs';

export function getDismissedPlanSlugs() {
    try {
        const raw = localStorage.getItem(DISMISSED_PLANS_KEY);
        const list = JSON.parse(raw || '[]');
        return new Set(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch {
        return new Set();
    }
}

export function dismissPlanSlug(slug) {
    if (!slug) return;
    const set = getDismissedPlanSlugs();
    set.add(slug);
    try {
        localStorage.setItem(DISMISSED_PLANS_KEY, JSON.stringify([...set]));
    } catch {}
}

export function undismissPlanSlug(slug) {
    if (!slug) return;
    const set = getDismissedPlanSlugs();
    set.delete(slug);
    try {
        localStorage.setItem(DISMISSED_PLANS_KEY, JSON.stringify([...set]));
    } catch {}
}
