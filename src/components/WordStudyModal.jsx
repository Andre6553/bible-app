import { useState, useEffect } from 'react';
import { getWordStudy } from '../services/aiService';
import { getUserId, getVerseByReference, getOriginalVerse, getVerseCount } from '../services/bibleService';
import './WordStudyModal.css';

function WordStudyModal({
    verse: initialVerse,
    verseText: initialVerseText,
    verseRef: initialVerseRef,
    originalText: initialOriginalText,
    originalVersion: initialOriginalVersion,
    onClose
}) {
    // Current verse being studied
    const [currentVerse, setCurrentVerse] = useState({
        verse: initialVerse,
        text: initialVerseText,
        ref: initialVerseRef,
        originalText: initialOriginalText,
        originalVersion: initialOriginalVersion
    });

    const [verseCount, setVerseCount] = useState(0);

    useEffect(() => {
        const loadCount = async () => {
            if (currentVerse.verse?.book_id && currentVerse.verse?.chapter) {
                const count = await getVerseCount(currentVerse.verse.book_id, currentVerse.verse.chapter);
                setVerseCount(count);
            }
        };
        loadCount();
    }, [currentVerse.verse?.book_id, currentVerse.verse?.chapter]);

    // Navigation History
    const [history, setHistory] = useState([]);

    const [selectedWord, setSelectedWord] = useState(null);
    const [studyData, setStudyData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleWordTap = async (word) => {
        if (!word || word.trim() === '') return;
        const cleanedWord = word.replace(/[.,!?;:]/g, '').trim();
        setSelectedWord(cleanedWord);
        setLoading(true);
        setError(null);
        setStudyData(null);

        try {
            const userId = getUserId();
            const result = await getWordStudy(userId, currentVerse.ref, currentVerse.text, currentVerse.originalText, cleanedWord);
            if (result.success) {
                setStudyData(result.data);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Failed to fetch study data');
        } finally {
            setLoading(false);
        }
    };

    const handleNavigateVerse = async (ref) => {
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch translation
            const verseRes = await getVerseByReference(ref);
            if (!verseRes.success) throw new Error('Could not find verse');

            const newVerse = verseRes.data;

            // 2. Fetch original text
            const originalRes = await getOriginalVerse(newVerse.book_id, newVerse.chapter, newVerse.verse);
            if (!originalRes.success) throw new Error('Original text not available');

            // 3. Save current to history
            setHistory(prev => [...prev, currentVerse]);

            // 4. Update current state
            setCurrentVerse({
                verse: newVerse,
                text: newVerse.text,
                ref: `${newVerse.books.name_full} ${newVerse.chapter}:${newVerse.verse}`,
                originalText: originalRes.text,
                originalVersion: originalRes.version
            });

            // 5. Reset study data
            setStudyData(null);
            setSelectedWord(null);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (history.length === 0) return;

        const previousVerse = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        setCurrentVerse(previousVerse);
        setStudyData(null);
        setSelectedWord(null);
    };

    return (
        <div className="word-study-overlay">
            <div className="word-study-modal">
                <div className="word-study-header">
                    <div className="ws-header-left">
                        <button className="ws-close-btn" onClick={onClose} title="Close">✕</button>
                        {history.length > 0 && (
                            <button className="ws-back-btn" onClick={handleBack} title="Back to previous study">
                                ← Back
                            </button>
                        )}
                    </div>
                    <div className="ws-header-center">
                        <div className="ws-verse-picker">
                            <button
                                className="ws-nav-btn"
                                disabled={currentVerse.verse.verse <= 1}
                                onClick={() => handleNavigateVerse(`${currentVerse.verse.book_id} ${currentVerse.verse.chapter}:${currentVerse.verse.verse - 1}`)}
                            >
                                ‹
                            </button>
                            <div className="ws-ref-badge">{currentVerse.ref}</div>
                            <button
                                className="ws-nav-btn"
                                disabled={currentVerse.verse.verse >= verseCount}
                                onClick={() => handleNavigateVerse(`${currentVerse.verse.book_id} ${currentVerse.verse.chapter}:${currentVerse.verse.verse + 1}`)}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                </div>

                <div className="word-study-content">
                    {/* Original Text Display */}
                    <div className="original-text-section">
                        <div className="ws-section-header">
                            <span className="ws-lang-label">
                                {currentVerse.originalVersion === 'SBLGNT' ? 'Greek (GNT)' : 'Hebrew (WLC)'}
                            </span>
                        </div>
                        <p className={`original-text ${currentVerse.originalVersion === 'WLC' ? 'hebrew' : 'greek'}`}>
                            {currentVerse.originalText}
                        </p>
                    </div>

                    {/* Translation with Word Selection */}
                    <div className="translation-select-section">
                        <p className="ws-instruction">Tap a word to see its original meaning:</p>
                        <div className="words-container">
                            {currentVerse.text.split(/(\s+)/).map((part, i) => {
                                if (part.trim() === '') return <span key={i}>{part}</span>;
                                const clean = part.replace(/[.,!?;:]/g, '');
                                return (
                                    <span
                                        key={i}
                                        className={`tappable-word ${selectedWord === clean ? 'selected' : ''}`}
                                        onClick={() => handleWordTap(clean)}
                                    >
                                        {part}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* AI Analysis Result */}
                    <div className="analysis-result-section">
                        {loading && (
                            <div className="ws-loading">
                                <div className="ws-spinner"></div>
                                <p>Consulting Lexicons...</p>
                            </div>
                        )}

                        {error && <div className="ws-error">⚠️ {error}</div>}

                        {studyData && (
                            <div className="ws-data">
                                <div className="ws-word-header">
                                    <h3 className="ws-original">{studyData.word.original}</h3>
                                    <span className="ws-translit">{studyData.word.transliteration}</span>
                                </div>
                                <div className="ws-lemma-row">
                                    <span className="ws-label">Lemma:</span> {studyData.word.lemma}
                                    {studyData.word.strongs && (
                                        <span className="ws-strongs">({studyData.word.strongs})</span>
                                    )}
                                </div>

                                <div className="ws-detail">
                                    <h4>Contextual Meaning in this Verse</h4>
                                    <p>{studyData.word.contextualMeaning}</p>
                                </div>

                                <div className="ws-detail divider">
                                    <h4>Lexical Definition</h4>
                                    <p>{studyData.word.definition}</p>
                                </div>

                                {studyData.word.culturalNuance && (
                                    <div className="ws-detail divider">
                                        <h4>Cultural & Theological Nuance</h4>
                                        <p>{studyData.word.culturalNuance}</p>
                                    </div>
                                )}

                                {studyData.relatedVerses && studyData.relatedVerses.length > 0 && (
                                    <div className="ws-related">
                                        <h4>Related Verses</h4>
                                        <div className="ws-related-list">
                                            {studyData.relatedVerses.map((ref, idx) => (
                                                <button
                                                    key={idx}
                                                    className="ws-related-chip"
                                                    onClick={() => handleNavigateVerse(ref)}
                                                >
                                                    {ref}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!selectedWord && !loading && (
                            <div className="ws-empty-state">
                                <div className="ws-empty-icon">📜</div>
                                <p>Select a word above to dive deeper into the original language.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WordStudyModal;
