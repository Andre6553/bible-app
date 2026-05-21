import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';
import { logEvent } from './analyticsService';
import { recordPlanBehavior } from './planIntelligenceService';
import {
    getPlanBookDisplayName,
} from '../constants/canonicalBooks';

/**
 * Reading Plan Service - Static curated plans with enrollment and progress tracking
 */

export const isAuthenticatedUser = async () => {
    const userId = await getUserId();
    return userId && !userId.startsWith('user_');
};

const requireAuth = async () => {
    const authed = await isAuthenticatedUser();
    if (!authed) {
        return { ok: false, error: 'Authentication required' };
    }
    return { ok: true, userId: await getUserId() };
};

export const getAvailablePlans = async () => {
    try {
        const { data, error } = await supabase
            .from('reading_plans')
            .select('id, slug, title_en, title_af, description_en, description_af, duration_days, category, cover_emoji, sort_order')
            .eq('is_active', true)
            .order('sort_order');

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        console.error('[ReadingPlans] getAvailablePlans:', err);
        return { success: false, error: err.message, data: [] };
    }
};

export const getPlanBySlug = async (slug) => {
    try {
        const { data, error } = await supabase
            .from('reading_plans')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] getPlanBySlug:', err);
        return { success: false, error: err.message };
    }
};

const ENROLLMENT_COLUMNS =
    'id, user_id, plan_id, status, started_at, completed_at, current_day, completed_days, last_activity_at, day_notes';

/** Lightweight plan embed — never include readings JSONB (too large for list queries). */
const PLAN_LIST_EMBED = `
    reading_plans (
        id, slug, title_en, title_af, description_en, description_af,
        duration_days, category, cover_emoji
    )
`;

const PLAN_LIST_FIELDS =
    'id, slug, title_en, title_af, description_en, description_af, duration_days, category, cover_emoji';

async function attachPlansToEnrollments(enrollments) {
    if (!enrollments?.length) return enrollments || [];
    const planIds = [...new Set(enrollments.map((e) => e.plan_id).filter(Boolean))];
    if (!planIds.length) return enrollments;

    const { data: plans, error } = await supabase
        .from('reading_plans')
        .select(PLAN_LIST_FIELDS)
        .in('id', planIds);

    if (error) throw error;
    const byId = Object.fromEntries((plans || []).map((p) => [p.id, p]));
    return enrollments.map((e) => ({ ...e, reading_plans: byId[e.plan_id] || null }));
}

async function fetchUserEnrollments(userId, statuses, single = false) {
    const baseColumns =
        'id, user_id, plan_id, status, started_at, completed_at, current_day, completed_days, last_activity_at';

    let query = supabase
        .from('user_reading_plans')
        .select(`${baseColumns}, day_notes`)
        .eq('user_id', userId)
        .in('status', statuses)
        .order('last_activity_at', { ascending: false });

    if (single) query = query.limit(1).maybeSingle();

    let { data, error } = await query;

    if (error?.code === '42703' || error?.message?.includes('day_notes')) {
        let retry = supabase
            .from('user_reading_plans')
            .select(baseColumns)
            .eq('user_id', userId)
            .in('status', statuses)
            .order('last_activity_at', { ascending: false });
        if (single) retry = retry.limit(1).maybeSingle();
        ({ data, error } = await retry);
    }

    if (error) throw error;
    return data;
}

export const getUserPlans = async () => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: true, data: [] };

    try {
        let { data, error } = await supabase
            .from('user_reading_plans')
            .select(`${ENROLLMENT_COLUMNS}, ${PLAN_LIST_EMBED}`)
            .eq('user_id', auth.userId)
            .in('status', ['active', 'paused', 'completed'])
            .order('last_activity_at', { ascending: false });

        if (error?.code === '42703' || error?.message?.includes('day_notes')) {
            ({ data, error } = await supabase
                .from('user_reading_plans')
                .select(`id, user_id, plan_id, status, started_at, completed_at, current_day, completed_days, last_activity_at, ${PLAN_LIST_EMBED}`)
                .eq('user_id', auth.userId)
                .in('status', ['active', 'paused', 'completed'])
                .order('last_activity_at', { ascending: false }));
        }

        if (error) {
            const enrollments = await fetchUserEnrollments(auth.userId, ['active', 'paused', 'completed']);
            data = await attachPlansToEnrollments(Array.isArray(enrollments) ? enrollments : []);
        }

        return { success: true, data: data || [] };
    } catch (err) {
        console.error('[ReadingPlans] getUserPlans:', err?.message || err, err?.code, err?.details);
        return { success: false, error: err.message, data: [] };
    }
};

export const getActivePlan = async () => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: true, data: null };

    try {
        const { data, error } = await supabase
            .from('user_reading_plans')
            .select(`
                id, user_id, plan_id, status, started_at, completed_at, current_day, completed_days, last_activity_at,
                ${PLAN_LIST_EMBED}
            `)
            .eq('user_id', auth.userId)
            .eq('status', 'active')
            .order('last_activity_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            const enrollment = await fetchUserEnrollments(auth.userId, ['active'], true);
            if (!enrollment) return { success: true, data: null };
            const [withPlan] = await attachPlansToEnrollments([enrollment]);
            return { success: true, data: withPlan || null };
        }

        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] getActivePlan:', err?.message || err, err?.code, err?.details);
        return { success: false, error: err.message, data: null };
    }
};

export const getEnrollmentForPlan = async (planId) => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: true, data: null };

    try {
        let { data, error } = await supabase
            .from('user_reading_plans')
            .select(ENROLLMENT_COLUMNS)
            .eq('user_id', auth.userId)
            .eq('plan_id', planId)
            .in('status', ['active', 'paused'])
            .maybeSingle();

        if (error?.code === '42703' || error?.message?.includes('day_notes')) {
            ({ data, error } = await supabase
                .from('user_reading_plans')
                .select('id, user_id, plan_id, status, started_at, completed_at, current_day, completed_days, last_activity_at')
                .eq('user_id', auth.userId)
                .eq('plan_id', planId)
                .in('status', ['active', 'paused'])
                .maybeSingle());
        }

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] getEnrollmentForPlan:', err?.message || err);
        return { success: false, error: err.message };
    }
};

export const enrollInPlan = async (planId) => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: false, error: auth.error, requiresAuth: true };

    try {
        const { data: existing } = await supabase
            .from('user_reading_plans')
            .select('id')
            .eq('user_id', auth.userId)
            .eq('plan_id', planId)
            .eq('status', 'active')
            .maybeSingle();

        if (existing) {
            return { success: false, error: 'Already enrolled in this plan', enrollment: existing };
        }

        const { data, error } = await supabase
            .from('user_reading_plans')
            .insert({
                user_id: auth.userId,
                plan_id: planId,
                status: 'active',
                current_day: 1,
                completed_days: [],
                started_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        logEvent('plan_enrolled', { plan_id: planId });
        const { data: planRow } = await supabase
            .from('reading_plans')
            .select('id, slug, title_en, title_af, description_en, description_af, duration_days, category')
            .eq('id', planId)
            .single();
        if (planRow) {
            recordPlanBehavior('plan_enrolled', planRow).catch(() => {});
        }
        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] enrollInPlan:', err);
        return { success: false, error: err.message };
    }
};

export const getDayReading = (plan, day) => {
    if (!plan?.readings || !Array.isArray(plan.readings)) return null;
    return plan.readings.find((r) => r.day === day) || null;
};

export const getProgressStats = (enrollment, plan) => {
    const duration = plan?.duration_days || enrollment?.reading_plans?.duration_days || 0;
    const completedDays = enrollment?.completed_days || [];
    const completedCount = completedDays.length;
    const percent = duration > 0 ? Math.round((completedCount / duration) * 100) : 0;
    const daysRemaining = Math.max(0, duration - completedCount);

    let streak = 0;
    if (completedCount > 0 && enrollment?.last_activity_at) {
        const lastActivity = new Date(enrollment.last_activity_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastDay = new Date(lastActivity);
        lastDay.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - lastDay) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
            streak = Math.min(completedCount, diffDays === 0 ? completedCount : 1);
            if (diffDays === 0 && completedCount > 1) {
                streak = completedCount;
            }
        }
    }

    const nextDay = enrollment?.current_day || 1;
    const isComplete = enrollment?.status === 'completed' || completedCount >= duration;

    return { percent, streak, daysRemaining, completedCount, nextDay, isComplete, duration };
};

export const markDayComplete = async (enrollmentId, day, planSlug) => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: false, error: auth.error, requiresAuth: true };

    try {
        const { data: enrollment, error: fetchErr } = await supabase
            .from('user_reading_plans')
            .select('*, reading_plans(duration_days, slug)')
            .eq('id', enrollmentId)
            .eq('user_id', auth.userId)
            .single();

        if (fetchErr) throw fetchErr;
        if (enrollment.status !== 'active') {
            return { success: false, error: 'Plan is not active' };
        }

        const completedDays = [...(enrollment.completed_days || [])];
        if (!completedDays.includes(day)) {
            completedDays.push(day);
            completedDays.sort((a, b) => a - b);
        }

        const duration = enrollment.reading_plans?.duration_days || 0;
        const isFinished = completedDays.length >= duration;
        const nextDay = Math.min(day + 1, duration + 1);

        const updates = {
            completed_days: completedDays,
            current_day: isFinished ? duration : Math.max(enrollment.current_day, nextDay),
            last_activity_at: new Date().toISOString(),
            status: isFinished ? 'completed' : 'active',
            completed_at: isFinished ? new Date().toISOString() : null,
        };

        const { data, error } = await supabase
            .from('user_reading_plans')
            .update(updates)
            .eq('id', enrollmentId)
            .eq('user_id', auth.userId)
            .select('*, reading_plans(*)')
            .single();

        if (error) throw error;

        logEvent('plan_day_complete', {
            plan_slug: planSlug || enrollment.reading_plans?.slug,
            day,
        });

        const planMeta = enrollment.reading_plans;
        if (planMeta?.slug) {
            const eventType = isFinished ? 'plan_completed' : 'plan_day_complete';
            recordPlanBehavior(eventType, planMeta, { day }).catch(() => {});
        }

        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] markDayComplete:', err);
        return { success: false, error: err.message };
    }
};

export const pausePlan = async (enrollmentId) => {
    return updatePlanStatus(enrollmentId, 'paused', 'plan_paused');
};

export const resumePlan = async (enrollmentId) => {
    return updatePlanStatus(enrollmentId, 'active');
};

export const abandonPlan = async (enrollmentId) => {
    return updatePlanStatus(enrollmentId, 'abandoned', 'plan_abandoned');
};

const updatePlanStatus = async (enrollmentId, status, behaviorEvent = null) => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: false, error: auth.error, requiresAuth: true };

    try {
        const { data, error } = await supabase
            .from('user_reading_plans')
            .update({
                status,
                last_activity_at: new Date().toISOString(),
            })
            .eq('id', enrollmentId)
            .eq('user_id', auth.userId)
            .select('*, reading_plans(id, slug, title_en, title_af, description_en, description_af, duration_days, category)')
            .single();

        if (error) throw error;

        if (behaviorEvent && data?.reading_plans) {
            recordPlanBehavior(behaviorEvent, data.reading_plans).catch(() => {});
        }

        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] updatePlanStatus:', err);
        return { success: false, error: err.message };
    }
};

export const formatPassageRef = (passage, books, language = 'en') => {
    if (!passage) return '';
    const name = getPlanBookDisplayName(books, passage.book_id, language);
    return `${name} ${passage.chapter}`;
};

export const formatDayPassages = (dayReading, books, language = 'en') => {
    if (!dayReading?.passages?.length) return '';
    return dayReading.passages
        .map((p) => formatPassageRef(p, books, language))
        .join(', ');
};

export const getDayCommentary = (dayReading, language = 'en') => {
    if (!dayReading) return '';
    return language === 'af'
        ? dayReading.commentary_af || dayReading.commentary_en || ''
        : dayReading.commentary_en || dayReading.commentary_af || '';
};

export const getDayCommentaryIntro = (dayReading, language = 'en') => {
    if (!dayReading) return '';
    return language === 'af'
        ? dayReading.commentary_intro_af || dayReading.commentary_intro_en || ''
        : dayReading.commentary_intro_en || dayReading.commentary_intro_af || '';
};

export const getDayCommentarySections = (dayReading, language = 'en') => {
    if (!dayReading?.commentary_sections?.length) {
        const flat = getDayCommentary(dayReading, language);
        return flat ? [{ heading: '', summary: flat, highlights: [] }] : [];
    }

    return dayReading.commentary_sections.map((section) => {
        const studyPointsRaw = language === 'af'
            ? section.study_points_af || section.study_points_en
            : section.study_points_en || section.study_points_af;

        let studyPoints = Array.isArray(studyPointsRaw)
            ? studyPointsRaw.map((p) => ({
                title: p.title,
                detail: p.detail || '',
                verses: p.verses || '',
            }))
            : [];

        if (!studyPoints.length) {
            const highlights = language === 'af'
                ? section.highlights_af || section.highlights_en || []
                : section.highlights_en || section.highlights_af || [];
            studyPoints = highlights.map((title) => ({ title, detail: '', verses: '' }));
        }

        return {
            book_id: section.book_id,
            chapter: section.chapter,
            heading: language === 'af' ? section.heading_af : section.heading_en,
            summary: language === 'af' ? section.summary_af : section.summary_en,
            studyPoints,
            teaching: language === 'af' ? section.teaching_af : section.teaching_en,
            teachingWhy: language === 'af' ? section.teaching_why_af : section.teaching_why_en,
            crossReferences: language === 'af'
                ? section.cross_references_af || section.cross_references_en || []
                : section.cross_references_en || section.cross_references_af || [],
            highlights: studyPoints.map((p) => p.title),
        };
    });
};

export const getDayQuestions = (dayReading, language = 'en') => {
    if (!dayReading) return [];
    const questions = language === 'af'
        ? dayReading.questions_af || dayReading.questions_en
        : dayReading.questions_en || dayReading.questions_af;
    return Array.isArray(questions) ? questions : [];
};

export const getDayNote = (enrollment, day) => {
    const notes = enrollment?.day_notes || {};
    return notes[String(day)] || notes[day] || '';
};

export const saveDayNote = async (enrollmentId, day, noteText) => {
    const auth = await requireAuth();
    if (!auth.ok) return { success: false, error: auth.error, requiresAuth: true };

    try {
        const { data: enrollment, error: fetchErr } = await supabase
            .from('user_reading_plans')
            .select('day_notes')
            .eq('id', enrollmentId)
            .eq('user_id', auth.userId)
            .single();

        if (fetchErr) throw fetchErr;

        const dayNotes = { ...(enrollment.day_notes || {}) };
        const trimmed = (noteText || '').trim();
        if (trimmed) {
            dayNotes[String(day)] = trimmed;
        } else {
            delete dayNotes[String(day)];
        }

        const { data, error } = await supabase
            .from('user_reading_plans')
            .update({
                day_notes: dayNotes,
                last_activity_at: new Date().toISOString(),
            })
            .eq('id', enrollmentId)
            .eq('user_id', auth.userId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('[ReadingPlans] saveDayNote:', err);
        return { success: false, error: err.message };
    }
};
