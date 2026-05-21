import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { logActivity } from '../services/bibleService';
import {
    getAvailablePlans,
    getUserPlans,
    getActivePlan,
    getProgressStats,
} from '../services/readingPlanService';
import {
    getPlanRecommendations,
    getProfileSummary,
    recordPlanBehavior,
} from '../services/planIntelligenceService';
import './ReadingPlans.css';

function ReadingPlans() {
    const navigate = useNavigate();
    const { settings, user } = useSettings();
    const [catalog, setCatalog] = useState([]);
    const [userPlans, setUserPlans] = useState([]);
    const [activePlan, setActivePlan] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [profileHint, setProfileHint] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loggingRef = useRef(false);

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
            ? 'Voorstelle meng jou studiegedrag, kuratering en nuwe ontdekkinge.'
            : 'Suggestions blend your study habits, curation, and new discoveries.',
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
        try {
            const [catalogRes, userRes, activeRes] = await Promise.all([
                getAvailablePlans(),
                getUserPlans(),
                getActivePlan(),
            ]);

            if (catalogRes.success) setCatalog(catalogRes.data);
            else setError(catalogRes.error);

            const plans = userRes.success ? userRes.data : [];
            if (userRes.success) setUserPlans(plans);
            if (activeRes.success) setActivePlan(activeRes.data);

            if (catalogRes.success && catalogRes.data?.length) {
                const recRes = await getPlanRecommendations(
                    catalogRes.data,
                    plans,
                    isAf ? 'af' : 'en'
                );
                if (recRes.success) {
                    setRecommendations(recRes.recommendations || []);
                    setProfileHint(getProfileSummary(recRes.profile, isAf ? 'af' : 'en'));
                }
            }
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const getEnrollmentForCatalogPlan = (planId) =>
        userPlans.find((up) => up.plan_id === planId && up.status !== 'abandoned');

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
                    {activePlan && activeStats && (
                        <section className="plans-section">
                            <h2 className="section-title">{t.continueReading}</h2>
                            <div className="plan-continue-card" onClick={handleContinueActive}>
                                <div className="plan-continue-emoji">
                                    {activePlan.reading_plans?.cover_emoji || '📖'}
                                </div>
                                <div className="plan-continue-info">
                                    <h3>
                                        {isAf
                                            ? activePlan.reading_plans?.title_af
                                            : activePlan.reading_plans?.title_en}
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
                                <button
                                    type="button"
                                    className="plan-cta-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleContinueActive();
                                    }}
                                >
                                    {t.continueBtn}
                                </button>
                            </div>
                        </section>
                    )}

                    {recommendations.length > 0 && (
                        <section className="plans-section plans-for-you">
                            <h2 className="section-title">{t.forYou}</h2>
                            <p className="plans-for-you-hint">{profileHint || t.forYouHint}</p>
                            <div className="plans-list">
                                {recommendations.map(({ plan, reasonLabel, reasonKey }) => {
                                    const isEnrolled = enrolledPlanIds.has(plan.id);
                                    return (
                                        <div
                                            key={`rec-${plan.id}`}
                                            className="plan-card catalog-card recommended-card"
                                            onClick={() => handleStartOrView(plan, 'recommended')}
                                        >
                                            <span className="plan-card-emoji">{plan.cover_emoji || '📖'}</span>
                                            <div className="plan-card-body">
                                                <span className={`plan-rec-badge ${reasonKey}`}>{reasonLabel}</span>
                                                <h3>{isAf ? plan.title_af : plan.title_en}</h3>
                                                <p className="plan-card-desc">
                                                    {isAf ? plan.description_af : plan.description_en}
                                                </p>
                                                <span className="plan-card-meta">
                                                    {plan.duration_days} {t.days}
                                                </span>
                                            </div>
                                            <button
                                                className="plan-cta-btn small"
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartOrView(plan, 'recommended');
                                                }}
                                            >
                                                {isEnrolled ? t.viewBtn : t.startBtn}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {userPlans.filter((p) => p.status === 'paused' || p.status === 'completed').length > 0 && (
                        <section className="plans-section">
                            <h2 className="section-title">{t.myPlans}</h2>
                            <div className="plans-list">
                                {userPlans
                                    .filter((p) => p.status === 'paused' || p.status === 'completed')
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
                                            <button
                                                className="plan-cta-btn small"
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartOrView(plan);
                                                }}
                                            >
                                                {isEnrolled ? t.viewBtn : t.startBtn}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}

export default ReadingPlans;
