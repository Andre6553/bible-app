import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { getBooks, logActivity } from '../services/bibleService';
import {
    getPlanBySlug,
    getEnrollmentForPlan,
    enrollInPlan,
    pausePlan,
    resumePlan,
    abandonPlan,
    getProgressStats,
    formatDayPassages,
    getDayNote,
    saveDayNote,
    isAuthenticatedUser,
} from '../services/readingPlanService';
import {
    deletePersonalPlan,
    generateSubjectPlan,
} from '../services/subjectPlanService';
import { useBackButton } from './BackButtonHandler';
import PlanDayReading from './PlanDayReading';
import PlanDayStudyPanel from './PlanDayStudyPanel';
import VersionSelector from './VersionSelector';
import { recordPlanBehavior } from '../services/planIntelligenceService';
import { resolveDbBookId } from '../constants/canonicalBooks';
import './ReadingPlans.css';

function ReadingPlanDetail({ currentVersion, setCurrentVersion, versions = [] }) {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [plan, setPlan] = useState(null);
    const [enrollment, setEnrollment] = useState(null);
    const [books, setBooks] = useState({ all: [] });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmAbandon, setConfirmAbandon] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState(null);
    const [expandedDay, setExpandedDay] = useState(null);
    const [noteDrafts, setNoteDrafts] = useState({});
    const [savingNoteDay, setSavingNoteDay] = useState(null);
    const noteTimers = useRef({});
    const viewedSlugRef = useRef(null);

    const isAf = settings.language === 'af';

    const t = {
        back: isAf ? '← Terug' : '← Back',
        startPlan: isAf ? 'Begin Plan' : 'Start Plan',
        readToday: isAf ? 'Lees Vandag' : 'Read Today',
        read: isAf ? 'Lees' : 'Read',
        day: isAf ? 'Dag' : 'Day',
        progress: isAf ? 'Vordering' : 'Progress',
        pause: isAf ? 'Pouseer' : 'Pause',
        resume: isAf ? 'Hervat' : 'Resume',
        abandon: isAf ? 'Verlaat Plan' : 'Leave Plan',
        complete: isAf ? 'Voltooi' : 'Done',
        loginTitle: isAf ? 'Teken aan vereis' : 'Sign In Required',
        loginMsg: isAf
            ? 'Jy benodig \'n gratis rekening om \'n leesplan te begin en vordering te stoor.'
            : 'You need a free account to start a reading plan and save your progress.',
        loginBtn: isAf ? 'Teken aan' : 'Sign In',
        cancel: isAf ? 'Kanselleer' : 'Cancel',
        confirmAbandon: isAf ? 'Verlaat hierdie plan?' : 'Leave this plan?',
        confirmAbandonMsg: isAf
            ? 'Jou vordering sal gestoor bly, maar die plan sal as verlaat gemerk word.'
            : 'Your progress will be saved but the plan will be marked as abandoned.',
        yes: isAf ? 'Ja, verlaat' : 'Yes, leave',
        notFound: isAf ? 'Plan nie gevind nie.' : 'Plan not found.',
        retry: isAf ? 'Probeer Weer' : 'Try Again',
        studyGuide: isAf ? 'Studie Gids' : 'Study Guide',
        commentary: isAf ? 'Kommentaar' : 'Commentary',
        keyPoints: isAf ? 'Sleutel punte uit hierdie hoofstuk' : 'Key points from this chapter',
        similarElsewhere: isAf ? 'Soortgelyk elders in die Skrif' : 'Similar elsewhere in Scripture',
        godTeaches: isAf ? 'Wat God ons wil leer' : 'What God wants us to know',
        why: isAf ? 'Hoekom? (uit hierdie teks)' : 'Why? (from this text)',
        seeVerses: isAf ? 'Sien' : 'See',
        questions: isAf ? 'Refleksie Vrae' : 'Reflection Questions',
        myNotes: isAf ? 'My Notas' : 'My Notes',
        notesPlaceholder: isAf
            ? 'Skryf jou persoonlike studienotas hier...'
            : 'Write your personal study notes here...',
        notesLoginHint: isAf
            ? 'Teken aan en begin die plan om persoonlike notas te stoor.'
            : 'Sign in and start the plan to save personal notes.',
        savingNotes: isAf ? 'Stoor...' : 'Saving...',
        expandStudy: isAf ? 'Wys studie' : 'Show study',
        collapseStudy: isAf ? 'Versteek studie' : 'Hide study',
        deletePlan: isAf ? 'Verwyder Plan' : 'Delete Plan',
        regenerate: isAf ? 'Skep \'n vars plan' : 'Generate a fresh plan',
        confirmDeleteTitle: isAf ? 'Verwyder hierdie plan?' : 'Delete this plan?',
        confirmDeleteMsg: isAf
            ? 'Hierdie plan verdwyn vir jou alleen. \'n Vars KI-plan kan vir jou geskep word — daardie nuwe plan (nie hierdie een) kan vir ander in die gemeenskapspoel gaan.'
            : 'This plan disappears for you only. A fresh AI plan can be created for you — that new plan (not this one) may join the community pool for others.',
        yesDelete: isAf ? 'Ja, verwyder' : 'Yes, delete',
        deleteAndRegenerate: isAf ? 'Verwyder en skep \'n vars plan' : 'Delete and generate a fresh plan',
        regenerating: isAf ? 'Skep \'n vars plan...' : 'Generating a fresh plan...',
        regenerateHint: isAf
            ? 'Die KI skep \'n vars plan vir jou. Daardie nuwe plan (nie die verwyderde een) kan vir ander gebruikers beskikbaar word.'
            : 'AI creates a fresh plan for you. That new plan (not the deleted one) may become available for other users.',
        personalBadge: isAf ? 'Persoonlik' : 'Personal',
        previewHint: isAf
            ? 'Blaai deur die dae hieronder om kommentaar en studie vrae te sien voordat jy begin.'
            : 'Browse the days below to preview commentary and study questions before you start.',
        bibleVersion: isAf ? 'Bybelweergawe' : 'Bible Version',
        versionHint: isAf
            ? 'Dieselfde weergawe as op die Bybel-oortjie. NLT/NIV ens. vereis dat die teks in die databasis gelaai is — KJV word outomaties gebruik indien nodig.'
            : 'Same version as the Bible tab. Some versions (e.g. NLT) need text loaded in the database — KJV is used automatically when needed.',
    };

    const activeVersionId = currentVersion?.id || 'KJV';

    const handleVersionChange = (version) => {
        setCurrentVersion?.(version);
        localStorage.setItem('lastBibleVersion', version.id);
    };

    const loadPlan = useCallback(async () => {
        setLoading(true);
        setError(null);
        const planRes = await getPlanBySlug(slug);
        if (!planRes.success) {
            setError(planRes.error);
            setLoading(false);
            return;
        }
        setPlan(planRes.data);

        if (planRes.data && viewedSlugRef.current !== slug) {
            viewedSlugRef.current = slug;
            recordPlanBehavior('plan_viewed', planRes.data).catch(() => {});
        }

        if (planRes.data?.id) {
            const enrollRes = await getEnrollmentForPlan(planRes.data.id);
            if (enrollRes.success) setEnrollment(enrollRes.data);
        }
        setLoading(false);
    }, [slug]);

    useEffect(() => {
        logActivity('plan_detail_visit');
        loadPlan();
        getBooks().then((res) => {
            if (res.success) setBooks(res.data);
        });
    }, [loadPlan]);

    useEffect(() => {
        if (!enrollment?.day_notes) return;
        const drafts = {};
        for (const [day, text] of Object.entries(enrollment.day_notes)) {
            drafts[day] = text;
        }
        setNoteDrafts(drafts);
    }, [enrollment?.id, enrollment?.day_notes]);

    useBackButton(confirmAbandon, () => setConfirmAbandon(false));
    useBackButton(confirmDelete && !regenerating, () => setConfirmDelete(false));

    const stats = plan && enrollment ? getProgressStats(enrollment, plan) : null;

    const promptAuth = () => {
        const msg = isAf
            ? 'Om \'n leesplan te begin, benodig jy \'n gratis rekening.\n\nWil jy nou teken aan?'
            : 'To start a reading plan, you need a free account.\n\nWould you like to sign in now?';
        if (window.confirm(msg)) navigate('/auth');
    };

    const handleStart = async () => {
        const authed = await isAuthenticatedUser();
        if (!authed) {
            promptAuth();
            return;
        }
        setActionLoading(true);
        const res = await enrollInPlan(plan.id);
        setActionLoading(false);
        if (res.requiresAuth) {
            promptAuth();
            return;
        }
        if (res.success) {
            setEnrollment(res.data);
        } else if (res.error?.includes('Already enrolled')) {
            await loadPlan();
        } else {
            alert(res.error);
        }
    };

    const handleReadDay = (day, passageIndex = 0) => {
        if (!enrollment) {
            promptAuth();
            return;
        }
        const dayReading = (plan.readings || []).find((r) => r.day === day);
        const passage = dayReading?.passages?.[passageIndex];
        if (!passage) return;

        navigate('/bible', {
            state: {
                bookId: resolveDbBookId(books, passage.book_id),
                chapter: passage.chapter,
                targetVerse: passage.verse_start || null,
                fromPlan: {
                    enrollmentId: enrollment.id,
                    planSlug: plan.slug,
                    planTitle: isAf ? plan.title_af : plan.title_en,
                    day,
                    passageIndex,
                    totalPassages: dayReading.passages.length,
                    dayReading,
                    verseStart: passage.verse_start || null,
                    verseEnd: passage.verse_end || null,
                },
            },
        });
    };

    const handlePauseResume = async () => {
        if (!enrollment) return;
        setActionLoading(true);
        const res =
            enrollment.status === 'paused'
                ? await resumePlan(enrollment.id)
                : await pausePlan(enrollment.id);
        setActionLoading(false);
        if (res.success) setEnrollment(res.data);
    };

    const handleAbandon = async () => {
        if (!enrollment) return;
        setActionLoading(true);
        const res = await abandonPlan(enrollment.id);
        setActionLoading(false);
        if (res.success) {
            setConfirmAbandon(false);
            navigate('/plans');
        }
    };

    const handleDelete = async () => {
        if (!plan?.id) return;
        setActionLoading(true);
        const res = await deletePersonalPlan(plan.id);
        setActionLoading(false);
        if (res.success) {
            setConfirmDelete(false);
            navigate('/plans');
        } else {
            alert(res.error || 'Could not delete plan');
        }
    };

    const handleDeleteAndRegenerate = async () => {
        if (!plan?.id) return;
        setRegenerating(true);
        const subjectInput = plan.subject || (isAf ? plan.title_af : plan.title_en);
        const durationDays = plan.duration_days || 7;

        const delRes = await deletePersonalPlan(plan.id);
        if (!delRes.success) {
            setRegenerating(false);
            alert(delRes.error || 'Could not delete plan');
            return;
        }

        const genRes = await generateSubjectPlan({
            subject: subjectInput,
            subjectSlug: plan.subject || null,
            durationDays,
            language: settings.language,
            shareToPool: true,
        });
        setRegenerating(false);
        setConfirmDelete(false);

        if (genRes.success && genRes.planSlug) {
            navigate(`/plans/${genRes.planSlug}`, { replace: true });
        } else {
            alert(genRes.error || 'Could not generate a fresh plan');
            navigate('/plans');
        }
    };

    const toggleDay = (day) => {
        setExpandedDay((prev) => (prev === day ? null : day));
    };

    const handleNoteChange = (day, value) => {
        setNoteDrafts((prev) => ({ ...prev, [String(day)]: value }));

        if (!enrollment) return;

        if (noteTimers.current[day]) {
            clearTimeout(noteTimers.current[day]);
        }

        noteTimers.current[day] = setTimeout(async () => {
            setSavingNoteDay(day);
            const res = await saveDayNote(enrollment.id, day, value);
            setSavingNoteDay(null);
            if (res.success) {
                setEnrollment(res.data);
            }
        }, 800);
    };

    const isDayComplete = (day) => enrollment?.completed_days?.includes(day);

    if (loading) {
        return (
            <div className="plans-container">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="plans-container">
                <button className="plans-back-btn" onClick={() => navigate('/plans')}>
                    {t.back}
                </button>
                <div className="error-state">
                    <p>{error || t.notFound}</p>
                    <button onClick={loadPlan}>{t.retry}</button>
                </div>
            </div>
        );
    }

    const title = isAf ? plan.title_af : plan.title_en;
    const description = isAf ? plan.description_af : plan.description_en;
    const studyGuide = isAf ? plan.study_guide_af : plan.study_guide_en;
    const isPersonalPlan = Boolean(plan.is_personal) || plan.category === 'personal';

    return (
        <div className="plans-container plan-detail">
            <button className="plans-back-btn" onClick={() => navigate('/plans')}>
                {t.back}
            </button>

            <header className="plan-detail-header">
                <span className="plan-detail-emoji">{plan.cover_emoji || '📖'}</span>
                <h1>{title}</h1>
                <p className="subtitle">{description}</p>
                <div className="plan-detail-meta-row">
                    <span className="plan-detail-meta">
                        {plan.duration_days} {isAf ? 'dae' : 'days'}
                    </span>
                    {isPersonalPlan && (
                        <span className="plan-detail-meta plan-detail-meta-personal">
                            {t.personalBadge}
                        </span>
                    )}
                </div>
            </header>

            {studyGuide && (
                <div className="plan-study-guide">
                    <h3>{t.studyGuide}</h3>
                    <p>{studyGuide}</p>
                </div>
            )}

            {versions.length > 0 && (
                <div className="plan-version-bar">
                    <label className="plan-version-label" htmlFor="plan-version-select">
                        {t.bibleVersion}
                    </label>
                    <VersionSelector
                        id="plan-version-select"
                        currentVersion={currentVersion}
                        onVersionChange={handleVersionChange}
                        versions={versions}
                        className="plan-version-select"
                    />
                    <p className="plan-version-hint">{t.versionHint}</p>
                </div>
            )}

            {!enrollment ? (
                <div className="plan-start-section">
                    <p className="plan-preview-hint">{t.previewHint}</p>
                    <button
                        className="plan-start-btn"
                        onClick={handleStart}
                        disabled={actionLoading}
                    >
                        {actionLoading ? '...' : t.startPlan}
                    </button>
                    {isPersonalPlan && (
                        <button
                            className="plan-action-btn danger plan-detail-delete-link"
                            onClick={() => setConfirmDelete(true)}
                            disabled={actionLoading || regenerating}
                        >
                            {t.deletePlan}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {stats && (
                        <div className="plan-stats-bar">
                            <div className="plan-progress-bar large">
                                <div
                                    className="plan-progress-fill"
                                    style={{ width: `${stats.percent}%` }}
                                />
                            </div>
                            <p className="plan-stats-text">
                                {t.progress}: {stats.completedCount}/{stats.duration} ({stats.percent}%)
                            </p>
                            {enrollment.status === 'active' && (
                                <button
                                    className="plan-read-today-btn"
                                    onClick={() => handleReadDay(stats.nextDay, 0)}
                                    disabled={stats.isComplete}
                                >
                                    {stats.isComplete ? t.complete : `${t.readToday} (${t.day} ${stats.nextDay})`}
                                </button>
                            )}
                            <div className="plan-actions-row">
                                {enrollment.status !== 'completed' && (
                                    <button
                                        className="plan-action-btn"
                                        onClick={handlePauseResume}
                                        disabled={actionLoading}
                                    >
                                        {enrollment.status === 'paused' ? t.resume : t.pause}
                                    </button>
                                )}
                                <button
                                    className="plan-action-btn danger"
                                    onClick={() => setConfirmAbandon(true)}
                                    disabled={actionLoading}
                                >
                                    {t.abandon}
                                </button>
                                {isPersonalPlan && (
                                    <button
                                        className="plan-action-btn danger"
                                        onClick={() => setConfirmDelete(true)}
                                        disabled={actionLoading || regenerating}
                                    >
                                        {t.deletePlan}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="plan-days-list">
                {(plan.readings || []).map((dayReading) => {
                    const done = isDayComplete(dayReading.day);
                    const isToday =
                        enrollment?.status === 'active' &&
                        dayReading.day === stats?.nextDay &&
                        !done;
                    const expanded = expandedDay === dayReading.day;
                    const noteValue =
                        noteDrafts[String(dayReading.day)] ??
                        getDayNote(enrollment, dayReading.day);

                    return (
                        <div
                            key={dayReading.day}
                            className={`plan-day-card ${done ? 'complete' : ''} ${isToday ? 'today' : ''} ${expanded ? 'expanded' : ''}`}
                        >
                            <div className="plan-day-row">
                                <button
                                    type="button"
                                    className="plan-day-toggle"
                                    onClick={() => toggleDay(dayReading.day)}
                                    aria-expanded={expanded}
                                >
                                    <span className="plan-day-num">
                                        {done ? '✓' : dayReading.day}
                                    </span>
                                    <div className="plan-day-info">
                                        <strong>
                                            {t.day} {dayReading.day}
                                            {isAf ? `: ${dayReading.title_af}` : `: ${dayReading.title_en}`}
                                        </strong>
                                        <p className="plan-day-passages">
                                            {formatDayPassages(dayReading, books, settings.language)}
                                        </p>
                                    </div>
                                    <span className="plan-day-expand-icon">{expanded ? '−' : '+'}</span>
                                </button>
                                {enrollment && !done && enrollment.status === 'active' && (
                                    <button
                                        className="plan-day-read-btn"
                                        onClick={() => handleReadDay(dayReading.day, 0)}
                                    >
                                        {t.read}
                                    </button>
                                )}
                            </div>

                            {expanded && (
                                <div className="plan-day-study">
                                    <PlanDayReading
                                        key={`${dayReading.day}-${activeVersionId}`}
                                        dayReading={dayReading}
                                        books={books}
                                        versionId={activeVersionId}
                                        language={settings.language}
                                    />
                                    <PlanDayStudyPanel
                                        dayReading={dayReading}
                                        language={settings.language}
                                        variant="detail"
                                    />
                                    <div className="plan-study-block">
                                        <h4>
                                            {t.myNotes}
                                            {savingNoteDay === dayReading.day && (
                                                <span className="plan-notes-saving">{t.savingNotes}</span>
                                            )}
                                        </h4>
                                        {enrollment ? (
                                            <textarea
                                                className="plan-notes-input"
                                                value={noteValue}
                                                onChange={(e) => handleNoteChange(dayReading.day, e.target.value)}
                                                placeholder={t.notesPlaceholder}
                                                rows={4}
                                            />
                                        ) : (
                                            <p className="plan-notes-hint">{t.notesLoginHint}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {confirmAbandon && (
                <div className="confirm-modal-overlay" onClick={() => setConfirmAbandon(false)}>
                    <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{t.confirmAbandon}</h3>
                        <p>{t.confirmAbandonMsg}</p>
                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => setConfirmAbandon(false)}
                                disabled={actionLoading}
                            >
                                {t.cancel}
                            </button>
                            <button
                                className="confirm-delete-btn"
                                onClick={handleAbandon}
                                disabled={actionLoading}
                            >
                                {actionLoading ? '...' : t.yes}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div
                    className="confirm-modal-overlay"
                    onClick={() => !regenerating && !actionLoading && setConfirmDelete(false)}
                >
                    <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{t.confirmDeleteTitle}</h3>
                        <p>{t.confirmDeleteMsg}</p>
                        {regenerating && (
                            <p className="plan-regenerate-hint">{t.regenerating}</p>
                        )}
                        {!regenerating && (
                            <p className="plan-regenerate-hint">{t.regenerateHint}</p>
                        )}
                        <div className="modal-actions modal-actions-stacked">
                            <button
                                className="plan-action-btn primary"
                                onClick={handleDeleteAndRegenerate}
                                disabled={actionLoading || regenerating}
                            >
                                {regenerating ? '...' : t.deleteAndRegenerate}
                            </button>
                            <button
                                className="confirm-delete-btn"
                                onClick={handleDelete}
                                disabled={actionLoading || regenerating}
                            >
                                {actionLoading ? '...' : t.yesDelete}
                            </button>
                            <button
                                className="cancel-btn"
                                onClick={() => setConfirmDelete(false)}
                                disabled={actionLoading || regenerating}
                            >
                                {t.cancel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReadingPlanDetail;
