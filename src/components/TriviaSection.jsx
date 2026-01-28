import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
import { getTriviaStats, checkDailyLimit, fetchQuestion, submitAnswer, syncDailyProgress } from '../services/triviaService';
import { logActivity } from '../services/bibleService';
import { useBackButton } from './BackButtonHandler';
import { AFRIKAANS_BOOK_NAMES } from '../constants/bookNames';
import './Trivia.css';

/**
 * Trivia Section - Bible Knowledge Game
 */
const TRIVIA_LABELS = {
    en: {
        title: "Bible Trivia",
        subtitle: "Test your knowledge of the Word",
        testament: "Testament",
        ot: "Old Testament",
        nt: "New Testament",
        both: "Both/Mixed",
        difficulty: "Difficulty",
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
        limit: "Daily Limit",
        used: "used",
        start: "Start Quiz",
        score: "Score",
        limitReached: "Daily Limit Reached",
        limitMsg: "You've answered",
        limitMsg2: "questions today.",
        comeBack: "Come back tomorrow for more!",
        login: "Login Required",
        plsLogin: "Please Login",
        needAccount: "You need an account to track your Bible knowledge scores.",
        goLogin: "Go to Login",
        loading: "Loading...",
        total: "Total",
        answered: "Answered",
        reset: "Reset Score",
        resetConfirm: "Are you sure? This will reset your session score to 0.",
        sessionScore: "Session Score",
        copied: "Copied!"
    },
    af: {
        title: "Bybel Trivia",
        subtitle: "Toets jou kennis van die Woord",
        testament: "Testament",
        ot: "Ou Testament",
        nt: "Nuwe Testament",
        both: "Albei/Gemeng",
        difficulty: "Moeilikheidsgraad",
        easy: "Maklik",
        medium: "Medium",
        hard: "Moeilik",
        limit: "Daglimiet",
        used: "gebruik",
        start: "Begin Vasvra",
        score: "Telling",
        limitReached: "Daglimiet Bereik",
        limitMsg: "Jy het vandag",
        limitMsg2: "vrae beantwoord.",
        comeBack: "Kom môre terug vir meer!",
        login: "Teken aan vereis",
        plsLogin: "Teken asseblief aan",
        needAccount: "Jy benodig 'n rekening om jou Bybelkennis-tellings op te spoor.",
        goLogin: "Gaan na Teken aan",
        loading: "Laai...",
        total: "Totaal",
        answered: "Beantwoord",
        reset: "Herstel Telling",
        resetConfirm: "Is jy seker? Dit sal jou sessietelling na 0 terugstel.",
        resetConfirm: "Is jy seker? Dit sal jou sessietelling na 0 terugstel.",
        sessionScore: "Sessie Telling",
        copied: "Gekopieer!"
    }
};

function TriviaSection() {
    const navigate = useNavigate();
    const { settings, user } = useSettings();
    const lang = settings.language === 'af' ? 'af' : 'en';
    const txt = TRIVIA_LABELS[lang];

    const [view, setView] = useState('menu'); // 'menu' | 'question' | 'limit_reached'
    const [loading, setLoading] = useState(false);

    // Stats
    const [stats, setStats] = useState({ totalCorrect: 0, totalAnswered: 0, todayCount: 0, currentStreak: 0 });
    const [limitInfo, setLimitInfo] = useState(null);
    const [showScorePopup, setShowScorePopup] = useState(false);

    // Session Reset Logic (Local Offset)
    const [sessionOffset, setSessionOffset] = useState({ correct: 0, answered: 0 });

    // Derived Display Stats
    const displayCorrect = Math.max(0, stats.totalCorrect - sessionOffset.correct);
    const displayAnswered = Math.max(0, (stats.totalAnswered || 0) - sessionOffset.answered);
    const displayPercent = displayAnswered > 0 ? Math.round((displayCorrect / displayAnswered) * 100) : 0;

    // Game Setup
    const [difficulty, setDifficulty] = useState('medium'); // easy, medium, hard
    const [testament, setTestament] = useState('NT'); // OT, NT

    // Current Question State
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [result, setResult] = useState(null); // { isCorrect, correctIndex, verseRef }

    // Hardware Back Button -> Profile
    useBackButton(true, () => {
        if (view !== 'menu') {
            setView('menu');
        } else {
            navigate('/profile');
        }
    });

    useEffect(() => {
        loadStats();
    }, [user]);

    const loadStats = async () => {
        if (!user) return;
        setLoading(true);
        const s = await getTriviaStats(user.id);
        const l = await checkDailyLimit(user.id);
        if (s) setStats(s);
        if (l) setLimitInfo(l);
        setLoading(false);
    };

    const handleResetSession = () => {
        if (window.confirm(txt.resetConfirm)) {
            setSessionOffset({
                correct: stats.totalCorrect,
                answered: stats.totalAnswered || 0
            });
            setShowScorePopup(false);
        }
    };



    const startGame = async () => {
        try {
            // Double check limit before visual transition
            const limitCheck = await checkDailyLimit(user.id);
            if (!limitCheck.allowed && !limitCheck.isAdmin) {
                setLimitInfo(limitCheck);
                setView('limit_reached');
                return;
            }

            setLoading(true);
            const res = await fetchQuestion(user.id, difficulty, testament, settings.language || 'en');
            if (res.success) {
                if (!res.question || !Array.isArray(res.question.options)) {
                    console.error("Invalid Question Data:", res.question);
                    alert("Error: Received invalid question data.");
                    setLoading(false);
                    return;
                }
                setCurrentQuestion(res.question);
                setView('question');
                setResult(null);
                setSelectedOption(null);
            } else {
                console.error("Failed to fetch:", res.error);
                if (res.error === 'DAILY_LIMIT_REACHED') {
                    setView('limit_reached');
                } else {
                    alert("Could not load question. " + (res.error || "Unknown error"));
                }
            }
        } catch (e) {
            console.error("CRASH in startGame:", e);
            alert("App Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionSelect = async (index) => {
        if (result || loading) return; // Prevent double tap

        setSelectedOption(index);
        setLoading(true); // Small loading state while submitting

        const subRes = await submitAnswer(user.id, currentQuestion.id, index);

        if (subRes.success) {
            setResult(subRes);
            logActivity('trivia_play');
            if (subRes.isCorrect) logActivity('trivia_correct');

            // OPTIMIZATION: Track count locally and sync periodically
            // We do NOT fetch getTriviaStats every time to save reads.
            // We do NOT write to DB every time.

            const newCount = (stats.todayCount || 0) + 1;
            const newTotal = (stats.totalCorrect || 0) + (subRes.isCorrect ? 1 : 0);
            const newStreak = subRes.isCorrect ? (stats.currentStreak || 0) + 1 : 0;

            setStats(prev => ({
                ...prev,
                todayCount: newCount,
                totalCorrect: newTotal,
                currentStreak: newStreak
            }));

            // Sync condition: Every 5 questions OR if limit reached
            const dailyLimit = limitInfo?.limit || 20;
            if (newCount % 5 === 0 || newCount >= dailyLimit) {
                console.log("Saving progress to DB...");
                await syncDailyProgress(user.id, newCount);
            }

            // Check immediate limit for UI blocking
            if (newCount >= dailyLimit && !limitInfo?.isAdmin) {
                setView('limit_reached');
            }

        } else {
            alert("Error submitting answer.");
        }
        setLoading(false);
    };

    const nextQuestion = () => {
        startGame(); // Re-fetch
    };

    const handleCopyDebug = async () => {
        if (!currentQuestion) return;

        let verseText = "Loading...";
        try {
            // Fetch English Verse Text
            const ref = currentQuestion.debug?.verseRef?.en;
            if (ref) {
                const lastSpaceIndex = ref.lastIndexOf(' ');
                const bookName = ref.substring(0, lastSpaceIndex);
                const chapterVerse = ref.substring(lastSpaceIndex + 1);
                const [chapter, verse] = chapterVerse.split(':');

                const { data } = await supabase
                    .from('verses')
                    .select(`
                        text,
                        books!inner(name_full)
                    `)
                    .eq('books.name_full', bookName)
                    .eq('chapter', chapter)
                    .eq('verse', verse)
                    .eq('version', 'NKJV')
                    .maybeSingle();

                if (data) verseText = data.text;
                else verseText = "Text not found";
            } else {
                verseText = "N/A";
            }
        } catch (e) {
            verseText = "Error fetching text";
            console.error(e);
        }

        const debugInfo = `
QUESTION :
-------------------
Question: ${currentQuestion.text}
Options:
${currentQuestion.options.map((opt, i) => `${i + 1}. ${opt} ${i === currentQuestion.debug?.correctIndex ? '(CORRECT)' : ''}`).join('\n')}

Verse Ref: ${currentQuestion.debug?.verseRef?.en || 'N/A'}
Verse Text: "${verseText}"
-------------------
`;
        navigator.clipboard.writeText(debugInfo);
        alert(txt.copied);
    };

    // Verse Popup State
    const [showVersePopup, setShowVersePopup] = useState(false);
    const [verseContent, setVerseContent] = useState(null); // { ref:Str, text:Str, version:Str }
    const [verseLoading, setVerseLoading] = useState(false);

    // ... (existing helper functions)

    const handleVerseClick = async () => {
        if (!result) return;

        const ref = settings.language === 'af' ? result.verseRef.af : result.verseRef.en;
        if (!ref) return;

        setShowVersePopup(true);
        setVerseLoading(true);
        setVerseContent(null); // Clear previous content to prevent stale data

        try {
            // Parse Ref: "Book Chapter:Verse" (e.g., "John 3:16" or "1 John 1:9")
            // This is tricky with names like "1 John". 
            // We'll trust the stored ref format or just do a fuzzy search?
            // Better: The user wants to see the verse content.
            // We can search for the verse text using searchVerses from bibleService OR custom query.
            // Let's use a specialized query here for precision.

            // Assume format "Bookname Chapter:Verse"
            // Split by last space to separate book and chapter:verse
            const lastSpaceIndex = ref.lastIndexOf(' ');
            const bookName = ref.substring(0, lastSpaceIndex);
            const chapterVerse = ref.substring(lastSpaceIndex + 1);
            const [chapter, verse] = chapterVerse.split(':');

            // Determine version based on language
            let currentVersion = 'NKJV';
            let dbBookName = bookName;

            if (settings.language === 'af') {
                currentVersion = 'AFR53';
                // Reverse lookup for Afrikaans -> English book name
                const englishName = Object.keys(AFRIKAANS_BOOK_NAMES).find(key => AFRIKAANS_BOOK_NAMES[key] === bookName);
                if (englishName) dbBookName = englishName;
            } else if (settings.primaryVersion) {
                // Optional: specific overrides if needed, but user requested explicit defaults
                currentVersion = 'NKJV';
            }

            // We need to find the book ID first... or just search text.
            // Let's use the 'verses' table with a join on 'books'.

            const { data, error } = await supabase
                .from('verses')
                .select(`
                    text,
                    version,
                    books!inner(name_full)
                `)
                .eq('books.name_full', dbBookName) // Use resolving English name
                .eq('chapter', chapter)
                .eq('verse', verse)
                .eq('version', currentVersion)
                .maybeSingle();

            if (data) {
                setVerseContent({
                    ref: ref,
                    text: data.text,
                    version: currentVersion
                });
            } else {
                // Fallback: Show message or try default KJV
                setVerseContent({
                    ref: ref,
                    text: "Verse text not available in this version.",
                    version: currentVersion
                });
            }

        } catch (e) {
            console.error("Error fetching verse:", e);
            setVerseContent({ ref: ref, text: "Error loading verse.", version: "" });
        }
        setVerseLoading(false);
    };

    // Render Logic
    if (!user) {
        // ... (Keep existing Login check)
        return (
            <div className="trivia-page">
                <div className="trivia-header">
                    <button className="back-btn" onClick={() => navigate('/profile')}>←</button>
                    <span className="trivia-stats-badge">Login Required</span>
                </div>
                <div className="trivia-setup-card">
                    <h2>Please Login</h2>
                    <p>You need an account to track your Bible knowledge scores.</p>
                    <button className="start-btn" onClick={() => navigate('/auth')}>Go to Login</button>
                </div>
            </div>
        );
    }

    // ... (Keep Limit Reached View)
    if (view === 'limit_reached') {
        // ... existing code ...
        return (
            <div className="trivia-page">
                <div className="trivia-header">
                    <button className="back-btn" onClick={() => navigate('/profile')}>←</button>
                    <span className="trivia-stats-badge">Limit Reached</span>
                </div>
                <div className="limit-reached-card">
                    <span className="lock-icon">🔒</span>
                    <h2>Daily Limit Reached</h2>
                    <div className="limit-score-display">
                        🏆 Score: {stats.totalCorrect}
                    </div>
                    <p>You've answered {stats.todayCount} questions today.</p>
                    <p>Come back tomorrow for more!</p>

                    {!limitInfo?.isPremium && (
                        <div style={{ marginTop: '30px' }}>
                            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Want more?</p>
                            <button className="upgrade-btn" onClick={() => navigate('/subscription')}>
                                Upgrade to Premium (100/day)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    /* QUESTION VIEW */
    if (view === 'question' && currentQuestion) {
        return (
            <div className="trivia-page">
                <div className="trivia-header">
                    <button className="back-btn" onClick={() => setView('menu')}>✕</button>
                    <span className="trivia-stats-badge">
                        Streak: {stats.currentStreak || 0}
                    </span>
                </div>

                <div className="question-container">

                    <div className="question-meta">
                        <span>{difficulty.toUpperCase()}</span>
                        <span
                            className="clickable"
                            onClick={handleCopyDebug}
                            title="Copy Debug Info"
                            data-debug-info={JSON.stringify(currentQuestion)}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            📋 {testament}
                        </span>
                    </div>

                    <div className="question-card">
                        <span className="question-text">{currentQuestion.text}</span>
                    </div>

                    <div className="answers-grid">
                        {currentQuestion.options.map((option, idx) => {
                            let statusClass = '';
                            if (result) {
                                if (idx === result.correctIndex) statusClass = 'correct';
                                else if (idx === selectedOption && !result.isCorrect) statusClass = 'wrong';
                            }

                            return (
                                <button
                                    key={idx}
                                    className={`answer-btn ${statusClass}`}
                                    onClick={() => handleOptionSelect(idx)}
                                    disabled={!!result}
                                >
                                    {option}
                                </button>
                            )
                        })}
                    </div>

                    {result && (
                        <div className="result-overlay">
                            {result.isCorrect ? (
                                <div className="correct-msg">✅ Correct!</div>
                            ) : (
                                <div className="wrong-msg">❌ Incorrect</div>
                            )}

                            {/* CLICKABLE REFERENCE */}
                            <span className="verse-ref clickable" onClick={handleVerseClick}>
                                📖 {settings.language === 'af' ? result.verseRef.af : result.verseRef.en}
                            </span>

                            <button className="next-btn" onClick={nextQuestion}>
                                {loading ? 'Loading...' : 'Next Question →'}
                            </button>
                        </div>
                    )}
                </div>

                {/* VERSE POPUP MODAL */}
                {showVersePopup && (
                    <div className="verse-popup-overlay">
                        <div className="verse-popup-content">
                            <button className="close-popup-btn" onClick={() => setShowVersePopup(false)}>✕</button>
                            <h3>{verseContent?.ref || 'Scripture'}</h3>
                            <div className="verse-body">
                                {verseLoading ? (
                                    <p>Loading verse...</p>
                                ) : (
                                    <>
                                        <p className="verse-text">"{verseContent?.text}"</p>
                                        <span className="verse-version">{verseContent?.version}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    /* MENU VIEW */
    return (
        <div className="trivia-page">
            <div className="trivia-header">
                <button className="back-btn" onClick={() => navigate('/profile')}>←</button>
                <div
                    className="trivia-stats-badge clickable"
                    onClick={() => setShowScorePopup(true)}
                    title={txt.score}
                >
                    🏆 {txt.score}: {displayCorrect}
                </div>
            </div>

            {/* SCORE POPUP */}
            {showScorePopup && (
                <div className="verse-popup-overlay" onClick={() => setShowScorePopup(false)}>
                    <div className="verse-popup-content score-popup" onClick={e => e.stopPropagation()}>
                        <button className="close-popup-btn" onClick={() => setShowScorePopup(false)}>×</button>

                        <h2 className="score-title">{txt.sessionScore}</h2>

                        <div className="score-circle">
                            <span className="score-percent">{displayPercent}%</span>
                        </div>

                        <div className="score-details">
                            <div className="score-row">
                                <span>{txt.score}:</span>
                                <span className="highlight-green">{displayCorrect}</span>
                            </div>
                            <div className="score-row">
                                <span>{txt.answered}:</span>
                                <span>{displayAnswered}</span>
                            </div>
                        </div>

                        <button className="reset-btn" onClick={handleResetSession}>
                            🔄 {txt.reset}
                        </button>
                    </div>
                </div>
            )}

            <div className="trivia-setup-card">
                <h1 className="trivia-title">{txt.title}</h1>
                <p className="trivia-subtitle">{txt.subtitle}</p>

                <div className="selector-group">
                    <span className="selector-label">{txt.testament}</span>
                    <div className="testament-options">
                        <button className={`option-btn ${testament === 'OT' ? 'active' : ''}`} onClick={() => setTestament('OT')}>
                            {txt.ot}
                        </button>
                        <button className={`option-btn ${testament === 'NT' ? 'active' : ''}`} onClick={() => setTestament('NT')}>
                            {txt.nt}
                        </button>
                        <button className={`option-btn ${testament === 'BOTH' ? 'active' : ''}`} onClick={() => setTestament('BOTH')}>
                            {txt.both}
                        </button>
                    </div>
                </div>

                <div className="selector-group">
                    <span className="selector-label">{txt.difficulty}</span>
                    <div className="difficulty-options">
                        <button className={`option-btn ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => setDifficulty('easy')}>
                            {txt.easy}
                        </button>
                        <button className={`option-btn ${difficulty === 'medium' ? 'active' : ''}`} onClick={() => setDifficulty('medium')}>
                            {txt.medium}
                        </button>
                        <button className={`option-btn ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => setDifficulty('hard')}>
                            {txt.hard}
                        </button>
                    </div>
                </div>

                <div style={{ margin: '20px 0', fontSize: '0.9rem', color: '#888' }}>
                    {txt.limit}: {stats.todayCount} / {limitInfo?.limit || '...'} {txt.used}
                </div>

                <button className="start-btn" onClick={startGame} disabled={loading}>
                    {loading ? txt.loading : txt.start}
                </button>
            </div>
        </div>
    );
}

export default TriviaSection;
