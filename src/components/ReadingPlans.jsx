import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { logActivity } from '../services/bibleService';
import {
    getAvailablePlans,
    getUserPlans,
    getActivePlan,
    getProgressStats,
    isAuthenticatedUser,
    abandonPlan,
} from '../services/readingPlanService';
import { getDismissedPlanSlugs, dismissPlanSlug } from '../services/planDismissService';
import { recordPlanBehavior } from '../services/planIntelligenceService';
import {
    SUBJECT_CHIPS,
    getSubjectLabel,
    getSuggestedSubjectsFromHistory,
    generateSubjectPlan,
    autoGenerateNextPlanIfDue,
    getAutoPlanEnabled,
    setAutoPlanEnabled,
    getUserSubjectPlans,
    getForYouPlans,
    ensureForYouPoolFilled,
    shouldRunForYouBackfill,
    clearForYouBackfillSession,
    isAiInCooldown,
    getAiCooldownMinutesLeft,
    FOR_YOU_PLAN_LIMIT,
    deletePersonalPlan,
    getSubjectChip,
} from '../services/subjectPlanService';
import { useBackButton } from './BackButtonHandler';
import './ReadingPlans.css';

function ReadingPlans() {
    const navigate = useNavigate();
    const { settings, user } = useSettings();
    const [catalog, setCatalog] = useState([]);
    const [userPlans, setUserPlans] = useState([]);
    const [activePlan, setActivePlan] = useState(null);
    const [forYouPlans, setForYouPlans] = useState([]);
    const [forYouHint, setForYouHint] = useState('');
    const [forYouMigrationPending, setForYouMigrationPending] = useState(false);
    const [forYouBackfill, setForYouBackfill] = useState({
        active: false,
        current: 0,
        target: FOR_YOU_PLAN_LIMIT,
        rateLimited: false,
    });
    const forYouBackfillRef = useRef(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loggingRef = useRef(false);

    const [suggestedSubjects, setSuggestedSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [subjectDuration, setSubjectDuration] = useState(7);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState(null);

    const [autoPlanBanner, setAutoPlanBanner] = useState(null);
    const [autoPlanEnabled, setAutoPlanEnabledState] = useState(getAutoPlanEnabled());
    const autoRunRef = useRef(false);

    const [personalPlans, setPersonalPlans] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [dismissedSlugs, setDismissedSlugs] = useState(() => getDismissedPlanSlugs());

    const isAf = settings.language === 'af';

    const t = {
        title: isAf ? '📅 Leesplanne' : '📅 Reading Plans',
        subtitle: isAf
            ? 'Volg gestruktureerde Skrifleesroetes'
            : 'Follow structured scripture reading journeys',
        continueReading: isAf ? 'Gaan voort met lees' : 'Continue Reading',
        dayOf: isAf ? 'Dag' : 'Day',
        of: isAf ? 'van' : 'of',
        myPlans: isAf ? 'My Planne' : 'My Plans',
        browse: isAf ? 'Blaai Planne' : 'Browse Plans',
        days: isAf ? 'dae' : 'days',
        complete: isAf ? 'Voltooi' : 'Complete',
        paused: isAf ? 'Gepouseer' : 'Paused',
        active: isAf ? 'Aktief' : 'Active',
        continueBtn: isAf ? 'Gaan voort' : 'Continue',
        viewBtn: isAf ? 'Bekyk' : 'View',
        startBtn: isAf ? 'Begin' : 'Start',
        noPlans: isAf ? 'Geen planne beskikbaar nie.' : 'No plans available.',
        retry: isAf ? 'Probeer Weer' : 'Try Again',
        loading: isAf ? 'Laai planne...' : 'Loading plans...',
        percentDone: isAf ? 'klaar' : 'done',
        forYou: isAf ? 'Vir jou' : 'For You',
        forYouHint: isAf
            ? 'Tot 20 verskillende gemeenskapplanne om van te kies — elke onderwerp verskyn hoogstens een keer. Jou eie planne staan apart hieronder.'
            : 'Up to 20 different community plans to pick from — each subject appears at most once. Your own plans are listed separately below.',
        forYouBackfillMsg: isAf
            ? 'Berei jou planne voor'
            : 'Preparing your plans',
        forYouBackfillDetail: isAf
            ? 'Die KI skep vars studieplanne sodat jy 20 kan kies — dit kan \'n minuut of twee neem.'
            : 'AI is creating fresh study plans so you have 20 to choose from — this may take a minute or two.',
        forYouRateLimit: isAf
            ? 'KI-limiet bereik — meer planne later vandag beskikbaar.'
            : 'AI limit reached — more plans will appear later today.',
        forYouEmpty: isAf
            ? 'Nog geen gemeenskapplanne beskikbaar nie.'
            : 'No community plans available yet.',
        forYouEmptyHint: isAf
            ? 'Die app probeer outomaties planne skep wanneer jy hier kom. Gebruik "Probeer weer" of skep jou eie plan hieronder.'
            : 'The app tries to create plans automatically when you visit. Use "Try again" or create your own plan below.',
        forYouMigration: isAf
            ? 'Databasis-opdatering nodig: voer plan_pool_migration.sql en subject_plans_migration.sql in Supabase SQL Editor uit.'
            : 'Database update required: run plan_pool_migration.sql and subject_plans_migration.sql in the Supabase SQL Editor.',
        forYouRetry: isAf ? 'Probeer weer' : 'Try again',
        subjectTitle: isAf ? '✨ Skep \'n Onderwerp-plan' : '✨ Create a Subject Plan',
        subjectHint: isAf
            ? 'Kies \'n onderwerp en die KI bou \'n persoonlike studieplan met daaglikse gedeeltes, kommentaar en refleksievrae.'
            : 'Pick a subject and AI builds a personal study plan with daily passages, commentary, and reflection questions.',
        suggestedTitle: isAf ? 'Op grond van jou soektogte' : 'Based on your searches',
        chipsTitle: isAf ? 'Onderwerpe om te ondersoek' : 'Subjects to explore',
        chooseDuration: isAf ? 'Kies tydsduur' : 'Choose duration',
        days3: isAf ? '3 dae' : '3 days',
        days7: isAf ? '7 dae' : '7 days',
        days14: isAf ? '14 dae' : '14 days',
        days30: isAf ? '30 dae' : '30 days',
        createPlan: isAf ? 'Skep my plan' : 'Create my plan',
        creating: isAf ? 'Skep jou plan...' : 'Building your plan...',
        creatingHint: isAf
            ? 'Dit kan 20-50 sekondes neem terwyl die KI gedeeltes kies en volle hoofstuk-studie-inhoud saamstel.'
            : 'This can take 20–50 seconds while AI picks passages and builds full chapter study content.',
        signInToCreate: isAf
            ? 'Om \'n persoonlike plan te skep, benodig jy \'n gratis rekening.\n\nWil jy nou teken aan?'
            : 'To create a personal subject plan, you need a free account.\n\nWould you like to sign in now?',
        chosenSubject: isAf ? 'Gekose onderwerp' : 'Chosen subject',
        clearChoice: isAf ? 'Verander' : 'Change',
        suggestedReasonEn: 'from your searches',
        suggestedReasonAf: 'uit jou soektogte',
        autoPlanReady: isAf ? '✨ Vars plan vir jou geskep' : '✨ Auto-generated for you',
        autoPlanOpen: isAf ? 'Open plan' : 'Open plan',
        autoPlanDismiss: isAf ? 'Sluit' : 'Dismiss',
        autoPlanToggleOn: isAf ? 'Outo-skep plan elke 2 dae: AAN' : 'Auto-create plan every 2 days: ON',
        autoPlanToggleOff: isAf ? 'Outo-skep plan elke 2 dae: AF' : 'Auto-create plan every 2 days: OFF',
        autoPlanToggleHint: isAf
            ? 'Wanneer aan, sal die KI elke 2 dae \'n vars plan oor \'n nuwe onderwerp skep — nooit presies dieselfde plan twee keer nie.'
            : 'When on, AI will quietly create a fresh plan every 2 days on a new subject — never the exact same plan twice.',
        mySubjectPlans: isAf ? 'Jou onderwerp-planne' : 'Your subject plans',
        mySubjectPlansHint: isAf
            ? 'Net jou eie planne — nie dieselfde as "Vir jou" hierbo nie. Verwyder enige tyd.'
            : 'Only your own plans — not the same as "For You" above. Delete any time.',
        deletePlan: isAf ? 'Verwyder' : 'Delete',
        confirmDeleteTitle: isAf ? 'Verwyder hierdie plan?' : 'Delete this plan?',
        confirmDeleteMsg: isAf
            ? 'Hierdie plan verdwyn vir jou (nie vir ander nie). \'n Vars KI-plan word vir jou geskep — daardie nuwe plan kan in die gemeenskapspoel gaan sodat ander dit kan ontdek.'
            : 'This plan disappears for you (not shared with others). A fresh AI plan is created for you — that new plan may join the community pool so others can discover it.',
        yesDelete: isAf ? 'Ja, verwyder' : 'Yes, delete',
        deleteAndRegenerate: isAf ? 'Verwyder en skep vars' : 'Delete and generate fresh',
        regenerating: isAf ? 'Skep vars plan...' : 'Generating fresh plan...',
        regenerateHint: isAf
            ? 'Die KI skep dadelik \'n vars plan vir jou. Daardie nuwe plan (nie die verwyderde een) kan vir ander gebruikers beskikbaar word.'
            : 'AI creates a fresh plan for you right away. That new plan (not the deleted one) can become available for other users.',
        cancel: isAf ? 'Kanselleer' : 'Cancel',
        personalBadge: isAf ? 'Persoonlik' : 'Personal',
        confirmRemoveTitle: isAf ? 'Verwyder van jou lys?' : 'Remove from your list?',
        confirmRemoveMsg: isAf
            ? 'Hierdie plan sal uit "Vir jou" verdwyn. As jy dit reeds begin het, word jou vordering ook verwyder. Jy kan dit steeds onder Blaai planne vind.'
            : 'This plan will be hidden from "For You". If you already started it, your progress will be cleared. You can still find it under Browse Plans.',
        yesRemove: isAf ? 'Ja, verwyder' : 'Yes, remove',
    };

    useBackButton(Boolean(deleteTarget) && !regenerating, () => setDeleteTarget(null));

    const isOwnedPersonalPlan = (plan) =>
        Boolean(plan?.is_personal) ||
        plan?.category === 'personal' ||
        personalPlans.some((p) => p.id === plan?.id);

    const openDeleteForPlan = (plan, kind = 'owned') => {
        if (!plan?.id) return;
        setDeleteTarget({
            id: plan.id,
            slug: plan.slug,
            subject: plan.subject,
            title_en: plan.title_en,
            title_af: plan.title_af,
            duration_days: plan.duration_days,
            isPersonal: isOwnedPersonalPlan(plan) || kind === 'owned',
            isPool: Boolean(plan?.is_pool) || kind === 'pool',
        });
    };

    const generateReplacementPlan = async (target) => {
        const chip = target?.subject ? getSubjectChip(target.subject) : null;
        const subjectLabel = chip
            ? isAf
                ? chip.af
                : chip.en
            : isAf
              ? target?.title_af
              : target?.title_en;
        return generateSubjectPlan({
            subject: subjectLabel || target?.subject || 'Faith',
            subjectSlug: target?.subject || chip?.slug || null,
            durationDays: target?.duration_days || 7,
            language: settings.language,
            shareToPool: true,
        });
    };

    useEffect(() => {
        if (!loggingRef.current) {
            logActivity('plans_page_visit');
            loggingRef.current = true;
        }
        loadData();
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        let forYouRes = { success: false, plans: [] };
        let personalData = [];
        let enrolledIds = [];
        try {
            const [catalogRes, userRes, activeRes, personalRes] = await Promise.all([
                getAvailablePlans(),
                getUserPlans(),
                getActivePlan(),
                getUserSubjectPlans(),
            ]);

            if (catalogRes.success) setCatalog(catalogRes.data);
            else setError(catalogRes.error);

            const plans = userRes.success ? userRes.data : [];
            if (userRes.success) setUserPlans(plans);
            if (activeRes.success) setActivePlan(activeRes.data);

            personalData = personalRes.success ? personalRes.data || [] : [];
            setPersonalPlans(personalData);

            enrolledIds = plans
                .filter((p) => p.status === 'active' || p.status === 'paused')
                .map((p) => p.plan_id);
            forYouRes = await getForYouPlans({
                language: isAf ? 'af' : 'en',
                dismissedSlugs: [...dismissedSlugs],
                enrolledPlanIds: enrolledIds,
                excludePersonalPlans: personalData,
            });
            if (forYouRes.success) {
                setForYouPlans(forYouRes.plans || []);
                setForYouHint(forYouRes.profileHint || '');
                setForYouMigrationPending(Boolean(forYouRes.migrationPending));
            }

            const suggRes = await getSuggestedSubjectsFromHistory({
                limit: 3,
                language: isAf ? 'af' : 'en',
            });
            if (suggRes.success) {
                setSuggestedSubjects(suggRes.suggestions || []);
            }
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);

        // Backfill "For You" to 20 pool plans when the feed is short (once per session).
        const userId = user?.id;
        if (isAiInCooldown()) {
            setForYouBackfill({
                active: false,
                current: forYouRes?.plans?.length || 0,
                target: FOR_YOU_PLAN_LIMIT,
                rateLimited: true,
            });
        } else if (!forYouBackfillRef.current && shouldRunForYouBackfill(userId)) {
            const initialCount = forYouRes?.success ? forYouRes.plans?.length || 0 : 0;
            if (initialCount < FOR_YOU_PLAN_LIMIT) {
                setTimeout(
                    () =>
                        runForYouBackfill({
                            initialCount,
                            enrolledPlanIds: enrolledIds,
                            personalData,
                        }),
                    300,
                );
            }
        }

        // Auto-generate the next plan if it's due. Runs at most once per
        // browser session per user (sessionStorage flag inside the service).
        if (!autoRunRef.current) {
            autoRunRef.current = true;
            // Defer slightly so it doesn't block initial render.
            setTimeout(async () => {
                const res = await autoGenerateNextPlanIfDue({
                    language: isAf ? 'af' : 'en',
                });
                if (res?.generated && res?.planSlug) {
                    setAutoPlanBanner({
                        slug: res.planSlug,
                        chipEn: res.chip?.en,
                        chipAf: res.chip?.af,
                        emoji: res.chip?.emoji || '✨',
                    });
                    // Refresh the user's plan list so the new one shows.
                    try {
                        const [refreshUserRes, refreshActiveRes] = await Promise.all([
                            getUserPlans(),
                            getActivePlan(),
                        ]);
                        if (refreshUserRes.success) setUserPlans(refreshUserRes.data);
                        if (refreshActiveRes.success) setActivePlan(refreshActiveRes.data);
                    } catch {}
                }
            }, 800);
        }
    };

    const isSignedInUser = Boolean(user?.id && !String(user.id).startsWith('user_'));

    const runForYouBackfill = async ({
        initialCount = forYouPlans.length,
        enrolledPlanIds = [],
        personalData = [],
    } = {}) => {
        if (!isSignedInUser || isAiInCooldown() || forYouBackfillRef.current) return;
        if (initialCount >= FOR_YOU_PLAN_LIMIT) return;

        forYouBackfillRef.current = true;
        setForYouBackfill({
            active: true,
            current: initialCount,
            target: FOR_YOU_PLAN_LIMIT,
            rateLimited: false,
        });

        let fillRes;
        try {
            fillRes = await ensureForYouPoolFilled({
                language: isAf ? 'af' : 'en',
                dismissedSlugs: [...dismissedSlugs],
                enrolledPlanIds,
                excludePersonalPlans: personalData,
                onProgress: ({ current, target }) => {
                    setForYouBackfill({
                        active: true,
                        current,
                        target,
                        rateLimited: false,
                    });
                },
            });
            if (fillRes.plans?.length) {
                setForYouPlans(fillRes.plans);
            } else {
                const refresh = await getForYouPlans({
                    language: isAf ? 'af' : 'en',
                    dismissedSlugs: [...dismissedSlugs],
                    enrolledPlanIds,
                    excludePersonalPlans: personalData,
                });
                if (refresh.success) {
                    setForYouPlans(refresh.plans || []);
                    setForYouMigrationPending(Boolean(refresh.migrationPending));
                }
            }
        } catch (err) {
            console.warn('[ReadingPlans] forYou backfill:', err?.message);
        } finally {
            forYouBackfillRef.current = false;
            setForYouBackfill((prev) => ({
                active: false,
                current: fillRes?.plans?.length ?? prev.current,
                target: FOR_YOU_PLAN_LIMIT,
                rateLimited: Boolean(fillRes?.rateLimited || fillRes?.deferred),
            }));
        }
    };

    const handleRetryForYou = () => {
        if (!user?.id) return;
        clearForYouBackfillSession(user.id);
        forYouBackfillRef.current = false;
        const enrolledIds = userPlans
            .filter((p) => p.status === 'active' || p.status === 'paused')
            .map((p) => p.plan_id);
        runForYouBackfill({ enrolledPlanIds: enrolledIds, personalData: personalPlans });
    };

    const handleToggleAutoPlan = () => {
        const next = !autoPlanEnabled;
        setAutoPlanEnabled(next);
        setAutoPlanEnabledState(next);
        if (!next) setAutoPlanBanner(null);
    };

    const handleOpenAutoPlan = () => {
        if (autoPlanBanner?.slug) {
            navigate(`/plans/${autoPlanBanner.slug}`);
        }
    };

    const promptSignIn = () => {
        if (window.confirm(t.signInToCreate)) {
            navigate('/auth');
        }
    };

    const handleSelectSubject = async (chip) => {
        const authed = await isAuthenticatedUser();
        if (!authed) {
            promptSignIn();
            return;
        }
        setGenerateError(null);
        setSelectedSubject(chip);
    };

    const handleClearSelection = () => {
        setSelectedSubject(null);
        setGenerateError(null);
    };

    const handleGenerate = async () => {
        if (!selectedSubject || generating) return;
        setGenerating(true);
        setGenerateError(null);
        const subjectLabel = getSubjectLabel(selectedSubject, isAf ? 'af' : 'en');
        const res = await generateSubjectPlan({
            subject: subjectLabel,
            subjectSlug: selectedSubject.slug,
            durationDays: subjectDuration,
            language: isAf ? 'af' : 'en',
        });
        setGenerating(false);
        if (res.requiresAuth) {
            promptSignIn();
            return;
        }
        if (res.success && res.planSlug) {
            setSelectedSubject(null);
            navigate(`/plans/${res.planSlug}`);
            return;
        }
        setGenerateError(
            res.error ||
                (isAf ? 'Kon nie plan skep nie. Probeer asseblief weer.' : 'Could not create plan. Please try again.'),
        );
    };

    const getEnrollmentForCatalogPlan = (planId) =>
        userPlans.find((up) => up.plan_id === planId && up.status !== 'abandoned');

    const getPersonalPlanCtaLabel = (enrollment) => {
        if (!enrollment) return t.startBtn;
        if (enrollment.status === 'active') return t.continueBtn;
        return t.viewBtn;
    };

    const handleDismissPoolPlan = async () => {
        if (!deleteTarget?.slug) return;
        setDeleteLoading(true);
        const enrollment = getEnrollmentForCatalogPlan(deleteTarget.id);
        if (enrollment) {
            await abandonPlan(enrollment.id);
        }
        dismissPlanSlug(deleteTarget.slug);
        setDismissedSlugs((prev) => new Set([...prev, deleteTarget.slug]));
        setDeleteLoading(false);
        setDeleteTarget(null);
        await loadData();
    };

    const handleDeletePlan = async () => {
        if (!deleteTarget?.id) return;
        const target = { ...deleteTarget };
        setDeleteLoading(true);

        if (target.isPool && !target.isPersonal) {
            const enrollment = getEnrollmentForCatalogPlan(target.id);
            if (enrollment) {
                await abandonPlan(enrollment.id);
            }
            dismissPlanSlug(target.slug);
            setDismissedSlugs((prev) => new Set([...prev, target.slug]));
            setDeleteLoading(false);
            setDeleteTarget(null);
            setRegenerating(true);
            const genRes = await generateReplacementPlan(target);
            setRegenerating(false);
            if (genRes.success && genRes.planSlug) {
                navigate(`/plans/${genRes.planSlug}`);
            } else {
                await loadData();
            }
            return;
        }

        const res = await deletePersonalPlan(target.id);
        if (!res.success) {
            setDeleteLoading(false);
            alert(res.error || (isAf ? 'Kon nie verwyder nie.' : 'Could not delete plan.'));
            return;
        }

        setRegenerating(true);
        const genRes = await generateReplacementPlan({
            subject: res.subject || deleteTarget.subject,
            duration_days: res.duration_days || deleteTarget.duration_days,
            title_en: deleteTarget.title_en,
            title_af: deleteTarget.title_af,
        });
        setRegenerating(false);
        setDeleteLoading(false);
        setDeleteTarget(null);
        setAutoPlanBanner(null);

        if (genRes.success && genRes.planSlug) {
            navigate(`/plans/${genRes.planSlug}`);
        } else {
            await loadData();
            if (genRes.error) {
                alert(genRes.error);
            }
        }
    };

    const handleRemoveCatalogPlan = async () => {
        if (!deleteTarget?.slug) return;
        setDeleteLoading(true);
        const enrollment = getEnrollmentForCatalogPlan(deleteTarget.id);
        if (enrollment) {
            await abandonPlan(enrollment.id);
        }
        dismissPlanSlug(deleteTarget.slug);
        setDismissedSlugs((prev) => new Set([...prev, deleteTarget.slug]));
        setDeleteLoading(false);
        setDeleteTarget(null);
        await loadData();
    };

    const handleDeleteAndRegenerate = async () => {
        if (!deleteTarget?.id) return;
        setRegenerating(true);
        const subjectInput = deleteTarget.subject || (isAf ? deleteTarget.title_af : deleteTarget.title_en);
        const durationDays = deleteTarget.duration_days || 7;

        const delRes = await deletePersonalPlan(deleteTarget.id);
        if (!delRes.success) {
            setRegenerating(false);
            alert(delRes.error || (isAf ? 'Kon nie verwyder nie.' : 'Could not delete plan.'));
            return;
        }

        const genRes = await generateSubjectPlan({
            subject: subjectInput,
            subjectSlug: deleteTarget.subject || null,
            durationDays,
            language: settings.language,
            shareToPool: true,
        });
        setRegenerating(false);
        setDeleteTarget(null);

        if (genRes.success && genRes.planSlug) {
            navigate(`/plans/${genRes.planSlug}`);
        } else {
            alert(genRes.error || (isAf ? 'Kon nie vars plan skep nie.' : 'Could not generate a fresh plan.'));
            await loadData();
        }
    };

    const handleStartOrView = (plan, source = 'catalog') => {
        if (source === 'recommended') {
            recordPlanBehavior('plan_catalog_click', plan, { section: 'for_you' }).catch(() => {});
        }
        navigate(`/plans/${plan.slug}`);
    };

    const handleContinueActive = () => {
        if (!activePlan?.reading_plans?.slug) return;
        navigate(`/plans/${activePlan.reading_plans.slug}`);
    };

    const activeStats = activePlan
        ? getProgressStats(activePlan, activePlan.reading_plans)
        : null;

    const enrolledPlanIds = new Set(
        userPlans.filter((p) => p.status === 'active' || p.status === 'paused').map((p) => p.plan_id)
    );

    return (
        <div className="plans-container">
            <header className="plans-header">
                <h1>{t.title}</h1>
                <p className="subtitle">{t.subtitle}</p>
            </header>

            {autoPlanBanner && (
                <div className="auto-plan-banner" role="status">
                    <div className="auto-plan-banner-text">
                        <span className="auto-plan-banner-emoji" aria-hidden="true">
                            {autoPlanBanner.emoji}
                        </span>
                        <div>
                            <strong>{t.autoPlanReady}</strong>
                            <span className="auto-plan-banner-subject">
                                {isAf ? autoPlanBanner.chipAf : autoPlanBanner.chipEn}
                            </span>
                        </div>
                    </div>
                    <div className="auto-plan-banner-actions">
                        <button
                            type="button"
                            className="auto-plan-banner-open"
                            onClick={handleOpenAutoPlan}
                        >
                            {t.autoPlanOpen}
                        </button>
                        <button
                            type="button"
                            className="auto-plan-banner-dismiss"
                            onClick={() => setAutoPlanBanner(null)}
                            aria-label={t.autoPlanDismiss}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>{t.loading}</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p>⚠️ {error}</p>
                    <button onClick={loadData}>{t.retry}</button>
                </div>
            ) : (
                <div className="plans-content">
                    {activePlan && activeStats && activePlan.reading_plans && (
                        <section className="plans-section">
                            <h2 className="section-title">{t.continueReading}</h2>
                            <div className="plan-continue-card" onClick={handleContinueActive}>
                                <div className="plan-continue-emoji">
                                    {activePlan.reading_plans.cover_emoji || '📖'}
                                </div>
                                <div className="plan-continue-info">
                                    <h3>
                                        {isAf
                                            ? activePlan.reading_plans.title_af
                                            : activePlan.reading_plans.title_en}
                                    </h3>
                                    <p>
                                        {t.dayOf} {activeStats.nextDay} {t.of}{' '}
                                        {activeStats.duration} · {activeStats.percent}% {t.percentDone}
                                    </p>
                                    <div className="plan-progress-bar">
                                        <div
                                            className="plan-progress-fill"
                                            style={{ width: `${activeStats.percent}%` }}
                                        />
                                    </div>
                                </div>
                                <div
                                    className="plan-card-actions plan-continue-actions"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        className="plan-cta-btn"
                                        onClick={handleContinueActive}
                                    >
                                        {t.continueBtn}
                                    </button>
                                    <button
                                        type="button"
                                        className="plan-delete-btn"
                                        aria-label={t.deletePlan}
                                        onClick={() => openDeleteForPlan(activePlan.reading_plans)}
                                    >
                                        {t.deletePlan}
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {isSignedInUser && (
                        <section className="plans-section plans-for-you">
                            <h2 className="section-title">{t.forYou}</h2>
                            <p className="plans-for-you-hint">{forYouHint || t.forYouHint}</p>
                            {forYouMigrationPending && (
                                <div className="for-you-backfill-banner for-you-migration-banner" role="status">
                                    <p>{t.forYouMigration}</p>
                                </div>
                            )}
                            {forYouBackfill.active && (
                                <div className="for-you-backfill-banner" role="status">
                                    <div className="loading-spinner" aria-hidden="true" />
                                    <div>
                                        <strong>{t.forYouBackfillMsg}</strong>
                                        <span>
                                            {forYouBackfill.current}/{forYouBackfill.target} — {t.forYouBackfillDetail}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {forYouBackfill.rateLimited && !forYouBackfill.active && (
                                <div className="for-you-backfill-banner for-you-rate-limit-banner" role="status">
                                    <p>
                                        {t.forYouRateLimit}
                                        {getAiCooldownMinutesLeft() > 0
                                            ? ` (${getAiCooldownMinutesLeft()} ${isAf ? 'min' : 'min'})`
                                            : ''}
                                    </p>
                                    <button
                                        type="button"
                                        className="plan-cta-btn for-you-retry-btn"
                                        onClick={handleRetryForYou}
                                        disabled={forYouBackfill.active || isAiInCooldown()}
                                    >
                                        {t.forYouRetry}
                                    </button>
                                </div>
                            )}
                            {!forYouBackfill.active &&
                                !forYouMigrationPending &&
                                forYouPlans.length === 0 &&
                                !forYouBackfill.rateLimited && (
                                    <div className="for-you-empty-state" role="status">
                                        <p>
                                            <strong>{t.forYouEmpty}</strong>
                                            <span>{t.forYouEmptyHint}</span>
                                        </p>
                                        <button
                                            type="button"
                                            className="plan-cta-btn for-you-retry-btn"
                                            onClick={handleRetryForYou}
                                            disabled={forYouBackfill.active}
                                        >
                                            {t.forYouRetry}
                                        </button>
                                    </div>
                                )}
                            <div className="plans-list plans-list-for-you">
                                {forYouPlans.map(({ plan, reasonLabel, reasonKey, kind }) => {
                                    const ctaLabel = getPersonalPlanCtaLabel(
                                        getEnrollmentForCatalogPlan(plan.id),
                                    );
                                    return (
                                        <div
                                            key={`foryou-${plan.id}`}
                                            className="plan-card catalog-card recommended-card"
                                            onClick={() => handleStartOrView(plan, 'recommended')}
                                        >
                                            <span className="plan-card-emoji">{plan.cover_emoji || '✨'}</span>
                                            <div className="plan-card-body">
                                                <span className={`plan-rec-badge ${reasonKey}`}>{reasonLabel}</span>
                                                <h3>{isAf ? plan.title_af : plan.title_en}</h3>
                                                <p className="plan-card-desc">
                                                    {isAf ? plan.description_af : plan.description_en}
                                                </p>
                                                <span className="plan-card-meta">
                                                    {plan.duration_days} {t.days}
                                                    {plan.subject &&
                                                        ` · ${plan.subject}`}
                                                </span>
                                            </div>
                                            <div
                                                className="plan-card-actions"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    className="plan-cta-btn small"
                                                    type="button"
                                                    onClick={() => handleStartOrView(plan, 'recommended')}
                                                >
                                                    {ctaLabel}
                                                </button>
                                                <button
                                                    className="plan-delete-btn"
                                                    type="button"
                                                    aria-label={t.deletePlan}
                                                    onClick={() => openDeleteForPlan(plan, kind)}
                                                >
                                                    {t.deletePlan}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {personalPlans.length > 0 && (
                        <section className="plans-section personal-plans-section">
                            <h2 className="section-title">{t.mySubjectPlans}</h2>
                            <p className="plans-for-you-hint">{t.mySubjectPlansHint}</p>
                            <div className="plans-list">
                                {personalPlans.map((plan) => {
                                    const enrollment = getEnrollmentForCatalogPlan(plan.id);
                                    const stats = enrollment
                                        ? getProgressStats(enrollment, plan)
                                        : null;
                                    const ctaLabel = getPersonalPlanCtaLabel(enrollment);
                                    return (
                                        <div
                                            key={plan.id}
                                            className="plan-card catalog-card personal-plan-card"
                                            onClick={() => handleStartOrView(plan)}
                                        >
                                            <span className="plan-card-emoji">{plan.cover_emoji || '✨'}</span>
                                            <div className="plan-card-body">
                                                <span className="plan-personal-badge">{t.personalBadge}</span>
                                                <h3>{isAf ? plan.title_af : plan.title_en}</h3>
                                                <p className="plan-card-desc">
                                                    {isAf ? plan.description_af : plan.description_en}
                                                </p>
                                                <span className="plan-card-meta">
                                                    {plan.duration_days} {t.days}
                                                    {enrollment && stats
                                                        ? ` · ${stats.percent}%`
                                                        : ''}
                                                    {enrollment?.status === 'paused' && ` · ${t.paused}`}
                                                    {enrollment?.status === 'active' && ` · ${t.active}`}
                                                </span>
                                            </div>
                                            <div
                                                className="plan-card-actions"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    className="plan-cta-btn small"
                                                    type="button"
                                                    onClick={() => handleStartOrView(plan)}
                                                >
                                                    {ctaLabel}
                                                </button>
                                                <button
                                                    className="plan-delete-btn"
                                                    type="button"
                                                    aria-label={t.deletePlan}
                                                    onClick={() => openDeleteForPlan(plan)}
                                                >
                                                    {t.deletePlan}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <section className="plans-section subject-plan-section">
                        <h2 className="section-title">{t.subjectTitle}</h2>
                        <p className="plans-for-you-hint">{t.subjectHint}</p>

                        <div className="auto-plan-toggle-row">
                            <button
                                type="button"
                                className={`auto-plan-toggle ${autoPlanEnabled ? 'on' : 'off'}`}
                                onClick={handleToggleAutoPlan}
                                aria-pressed={autoPlanEnabled}
                            >
                                <span className="auto-plan-toggle-dot" aria-hidden="true" />
                                <span className="auto-plan-toggle-label">
                                    {autoPlanEnabled ? t.autoPlanToggleOn : t.autoPlanToggleOff}
                                </span>
                            </button>
                            <p className="auto-plan-toggle-hint">{t.autoPlanToggleHint}</p>
                        </div>

                        {suggestedSubjects.length > 0 && (
                            <div className="subject-suggested-block">
                                <p className="subject-suggested-label">{t.suggestedTitle}</p>
                                <div className="subject-chips-row">
                                    {suggestedSubjects.map(({ chip, label }) => {
                                        const active = selectedSubject?.slug === chip.slug;
                                        return (
                                            <button
                                                key={`sugg-${chip.slug}`}
                                                type="button"
                                                className={`subject-chip suggested ${active ? 'active' : ''}`}
                                                onClick={() => handleSelectSubject(chip)}
                                            >
                                                <span className="subject-chip-emoji">{chip.emoji}</span>
                                                <span className="subject-chip-label">{label}</span>
                                                <span className="subject-chip-reason">
                                                    {isAf ? t.suggestedReasonAf : t.suggestedReasonEn}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <p className="subject-suggested-label">{t.chipsTitle}</p>
                        <div className="subject-chips-grid">
                            {SUBJECT_CHIPS.map((chip) => {
                                const active = selectedSubject?.slug === chip.slug;
                                const label = getSubjectLabel(chip, isAf ? 'af' : 'en');
                                return (
                                    <button
                                        key={chip.slug}
                                        type="button"
                                        className={`subject-chip ${active ? 'active' : ''}`}
                                        onClick={() => handleSelectSubject(chip)}
                                    >
                                        <span className="subject-chip-emoji">{chip.emoji}</span>
                                        <span className="subject-chip-label">{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedSubject && (
                            <div className="subject-create-panel">
                                <div className="subject-create-header">
                                    <div className="subject-create-title">
                                        <span className="subject-create-emoji">{selectedSubject.emoji}</span>
                                        <div>
                                            <span className="subject-create-label">{t.chosenSubject}</span>
                                            <strong>{getSubjectLabel(selectedSubject, isAf ? 'af' : 'en')}</strong>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="subject-create-clear"
                                        onClick={handleClearSelection}
                                        disabled={generating}
                                    >
                                        {t.clearChoice}
                                    </button>
                                </div>

                                <p className="subject-create-question">{t.chooseDuration}</p>
                                <div className="subject-duration-row">
                                    {[3, 7, 14, 30].map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            className={`subject-duration-btn ${subjectDuration === d ? 'active' : ''}`}
                                            onClick={() => setSubjectDuration(d)}
                                            disabled={generating}
                                        >
                                            {d === 3 ? t.days3 : d === 7 ? t.days7 : d === 14 ? t.days14 : t.days30}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    className="plan-start-btn subject-generate-btn"
                                    onClick={handleGenerate}
                                    disabled={generating}
                                >
                                    {generating ? t.creating : t.createPlan}
                                </button>

                                {generating && <p className="subject-generate-hint">{t.creatingHint}</p>}
                                {generateError && (
                                    <p className="subject-generate-error">⚠️ {generateError}</p>
                                )}
                            </div>
                        )}
                    </section>

                    {userPlans.filter((p) => {
                        if (p.status !== 'paused' && p.status !== 'completed') return false;
                        const plan = p.reading_plans;
                        const isPersonal =
                            plan?.category === 'personal' ||
                            personalPlans.some((pp) => pp.id === plan?.id);
                        return !isPersonal;
                    }).length > 0 && (
                        <section className="plans-section">
                            <h2 className="section-title">{t.myPlans}</h2>
                            <div className="plans-list">
                                {userPlans
                                    .filter((p) => {
                                        if (p.status !== 'paused' && p.status !== 'completed') return false;
                                        const plan = p.reading_plans;
                                        const isPersonal =
                                            plan?.category === 'personal' ||
                                            personalPlans.some((pp) => pp.id === plan?.id);
                                        return !isPersonal;
                                    })
                                    .map((enrollment) => {
                                        const plan = enrollment.reading_plans;
                                        const stats = getProgressStats(enrollment, plan);
                                        return (
                                            <div
                                                key={enrollment.id}
                                                className="plan-card"
                                                onClick={() => navigate(`/plans/${plan?.slug}`)}
                                            >
                                                <span className="plan-card-emoji">{plan?.cover_emoji || '📖'}</span>
                                                <div className="plan-card-body">
                                                    <h3>{isAf ? plan?.title_af : plan?.title_en}</h3>
                                                    <span className={`plan-status-badge ${enrollment.status}`}>
                                                        {enrollment.status === 'completed' ? t.complete : t.paused}
                                                    </span>
                                                    <span className="plan-card-meta">
                                                        {stats.percent}% · {plan?.duration_days} {t.days}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </section>
                    )}

                    <section className="plans-section">
                        <h2 className="section-title">{t.browse}</h2>
                        {catalog.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📅</div>
                                <p>{t.noPlans}</p>
                            </div>
                        ) : (
                            <div className="plans-list">
                                {catalog.map((plan) => {
                                    const enrollment = getEnrollmentForCatalogPlan(plan.id);
                                    const isEnrolled = enrolledPlanIds.has(plan.id);
                                    return (
                                        <div
                                            key={plan.id}
                                            className="plan-card catalog-card"
                                            onClick={() => handleStartOrView(plan)}
                                        >
                                            <span className="plan-card-emoji">{plan.cover_emoji || '📖'}</span>
                                            <div className="plan-card-body">
                                                <h3>{isAf ? plan.title_af : plan.title_en}</h3>
                                                <p className="plan-card-desc">
                                                    {isAf ? plan.description_af : plan.description_en}
                                                </p>
                                                <span className="plan-card-meta">
                                                    {plan.duration_days} {t.days}
                                                    {enrollment?.status === 'completed' &&
                                                        ` · ${getProgressStats(enrollment, plan).percent}%`}
                                                </span>
                                            </div>
                                            <div
                                                className="plan-card-actions"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    className="plan-cta-btn small"
                                                    type="button"
                                                    onClick={() => handleStartOrView(plan)}
                                                >
                                                    {isEnrolled ? t.viewBtn : t.startBtn}
                                                </button>
                                                <button
                                                    className="plan-delete-btn"
                                                    type="button"
                                                    aria-label={t.deletePlan}
                                                    onClick={() => openDeleteForPlan(plan)}
                                                >
                                                    {t.deletePlan}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {deleteTarget && (
                <div
                    className="confirm-modal-overlay"
                    onClick={() => !deleteLoading && !regenerating && setDeleteTarget(null)}
                >
                    <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
                        {deleteTarget.isPersonal || deleteTarget.isPool ? (
                            <>
                                <h3>{t.confirmDeleteTitle}</h3>
                                <p>{t.confirmDeleteMsg}</p>
                                {regenerating && <p className="plan-regenerate-hint">{t.regenerating}</p>}
                                {!regenerating && (
                                    <p className="plan-regenerate-hint">{t.regenerateHint}</p>
                                )}
                                <div className="modal-actions modal-actions-stacked">
                                    <button
                                        type="button"
                                        className="plan-action-btn primary"
                                        onClick={handleDeleteAndRegenerate}
                                        disabled={deleteLoading || regenerating}
                                    >
                                        {regenerating ? '...' : t.deleteAndRegenerate}
                                    </button>
                                    <button
                                        type="button"
                                        className="confirm-delete-btn"
                                        onClick={handleDeletePlan}
                                        disabled={deleteLoading || regenerating}
                                    >
                                        {deleteLoading ? '...' : t.yesDelete}
                                    </button>
                                    <button
                                        type="button"
                                        className="cancel-btn"
                                        onClick={() => setDeleteTarget(null)}
                                        disabled={deleteLoading || regenerating}
                                    >
                                        {t.cancel}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3>{t.confirmRemoveTitle}</h3>
                                <p>{t.confirmRemoveMsg}</p>
                                <div className="modal-actions modal-actions-stacked">
                                    <button
                                        type="button"
                                        className="confirm-delete-btn"
                                        onClick={handleRemoveCatalogPlan}
                                        disabled={deleteLoading}
                                    >
                                        {deleteLoading ? '...' : t.yesRemove}
                                    </button>
                                    <button
                                        type="button"
                                        className="cancel-btn"
                                        onClick={() => setDeleteTarget(null)}
                                        disabled={deleteLoading}
                                    >
                                        {t.cancel}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReadingPlans;
