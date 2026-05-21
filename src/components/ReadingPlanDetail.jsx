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
    getDayCommentaryIntro,
    getDayCommentarySections,
    getDayQuestions,
    getDayNote,
    saveDayNote,
    isAuthenticatedUser,
} from '../services/readingPlanService';
import { useBackButton } from './BackButtonHandler';
import PlanDayReading from './PlanDayReading';
import VersionSelector from './VersionSelector';
import { recordPlanBehavior } from '../services/planIntelligenceService';
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
        previewHint: isAf
            ? 'Blaai deur die dae hieronder om kommentaar en studie vrae te sien voordat jy begin.'
            : 'Browse the days below to preview commentary and study questions before you start.',
        bibleVersion: isAf ? 'Bybelweergawe' : 'Bible Version',
        versionHint: isAf
            ? 'Dieselfde weergawe as op die Bybel-oortjie. Verander hier of in die Bybel-lezer.'
            : 'Same version as the Bible tab. Change here or in the Bible reader.',
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
                bookId: passage.book_id,
                chapter: passage.chapter,
                fromPlan: {
                    enrollmentId: enrollment.id,
                    planSlug: plan.slug,
                    planTitle: isAf ? plan.title_af : plan.title_en,
                    day,
                    passageIndex,
                    totalPassages: dayReading.passages.length,
                    dayReading,
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

    return (
        <div className="plans-container plan-detail">
            <button className="plans-back-btn" onClick={() => navigate('/plans')}>
                {t.back}
            </button>

            <header className="plan-detail-header">
                <span className="plan-detail-emoji">{plan.cover_emoji || '📖'}</span>
                <h1>{title}</h1>
                <p className="subtitle">{description}</p>
                <span className="plan-detail-meta">
                    {plan.duration_days} {isAf ? 'dae' : 'days'}
                </span>
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
                    const commentaryIntro = getDayCommentaryIntro(dayReading, settings.language);
                    const commentarySections = getDayCommentarySections(dayReading, settings.language);
                    const questions = getDayQuestions(dayReading, settings.language);
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
                                    {(commentaryIntro || commentarySections.length > 0) && (
                                        <div className="plan-study-block plan-commentary-block">
                                            <h4>{t.commentary}</h4>
                                            {commentaryIntro && (
                                                <p className="plan-commentary-intro">{commentaryIntro}</p>
                                            )}
                                            {commentarySections.map((section, idx) => (
                                                <div
                                                    key={`${section.book_id || 's'}-${section.chapter || idx}`}
                                                    className="plan-commentary-section"
                                                >
                                                    {section.heading && (
                                                        <h5 className="plan-commentary-heading">{section.heading}</h5>
                                                    )}
                                                    <p className="plan-commentary-summary">{section.summary}</p>
                                                    {section.studyPoints?.length > 0 && (
                                                        <div className="plan-commentary-highlights">
                                                            <span className="plan-commentary-highlights-label">
                                                                {t.keyPoints}
                                                            </span>
                                                            <div className="plan-study-points">
                                                                {section.studyPoints.map((point, i) => (
                                                                    <div key={i} className="plan-study-point">
                                                                        <strong className="plan-study-point-title">
                                                                            {point.title}
                                                                            {point.verses && (
                                                                                <span className="plan-verse-ref">
                                                                                    {' '}{t.seeVerses} {point.verses}
                                                                                </span>
                                                                            )}
                                                                        </strong>
                                                                        {point.detail && (
                                                                            <p className="plan-study-point-detail">
                                                                                {point.detail}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {section.teaching && (
                                                        <div className="plan-teaching-block">
                                                            <span className="plan-commentary-highlights-label">
                                                                {t.godTeaches}
                                                            </span>
                                                            <p className="plan-teaching-message">{section.teaching}</p>
                                                            {section.teachingWhy && (
                                                                <>
                                                                    <span className="plan-teaching-why-label">{t.why}</span>
                                                                    <p className="plan-teaching-why">{section.teachingWhy}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    {section.crossReferences?.length > 0 && (
                                                        <div className="plan-cross-references">
                                                            <span className="plan-commentary-highlights-label">
                                                                {t.similarElsewhere}
                                                            </span>
                                                            {section.crossReferences.map((cr, i) => (
                                                                <div key={i} className="plan-cross-ref">
                                                                    <strong className="plan-cross-ref-title">{cr.ref}</strong>
                                                                    <p className="plan-cross-ref-text">{cr.comparison}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {questions.length > 0 && (
                                        <div className="plan-study-block">
                                            <h4>{t.questions}</h4>
                                            <ul className="plan-study-questions">
                                                {questions.map((q, i) => (
                                                    <li key={i}>{q}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
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
        </div>
    );
}

export default ReadingPlanDetail;
