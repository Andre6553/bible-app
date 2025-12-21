import { useState, useEffect } from 'react';
import { getWordStudy } from '../services/aiService';
import { getUserId, getVerseByReference, getOriginalVerse, getVerseCount } from '../services/bibleService';
import { saveWordStudy, deleteWordStudy, checkIsWordStudySaved } from '../services/wordStudyService';
import { useSettings } from '../context/SettingsContext';
import './WordStudyModal.css';

function WordStudyModal({
    verse: initialVerse,
    verseText: initialVerseText,
    verseRef: initialVerseRef,
    originalText: initialOriginalText,
    originalVersion: initialOriginalVersion,
    initialSelectedWord = null,
    initialStudyData = null,
    onClose
}) {
    const { settings } = useSettings();
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

    const [selectedWord, setSelectedWord] = useState(initialSelectedWord);
    const [studyData, setStudyData] = useState(initialStudyData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const translations = {
        en: {
            wordStudy: "Word Study",
            lemma: "Lemma",
            relatedNoun: "Related Noun",
            grammar: "Grammar",
            verse: "Verse",
            contextualMeaning: "Contextual Meaning in this Verse",
            whatThisWordDoes: "What This Word Does",
            lexicalDefinition: "Lexical Definition",
            culturalNuance: "Cultural & Historical Nuance",
            theologicalConnection: "Theological Connection",
            relatedVerses: "Related Verses",
            back: "Back",
            close: "Close",
            instruction: "Tap a word to see its original meaning:",
            emptyState: "Select a word above to dive deeper into the original language."
        },
        af: {
            wordStudy: "Woordstudie",
            lemma: "Lemma",
            relatedNoun: "Verwante Naamwoord",
            grammar: "Grammatika",
            verse: "Vers",
            contextualMeaning: "Kontekstuele Betekenis in hierdie Vers",
            whatThisWordDoes: "Wat Hierdie Woord Doen",
            lexicalDefinition: "Leksikale Definisie",
            culturalNuance: "Kulturele & Historiese Nuanse",
            theologicalConnection: "Teologiese Verband",
            relatedVerses: "Verwante Verse",
            back: "Terug",
            close: "Maak Toe",
            instruction: "Tik op 'n woord om die oorspronklike betekenis te sien:",
            emptyState: "Kies 'n woord hierbo om dieper in die oorspronklike taal te delf."
        }
    };

    const t = translations[settings.language] || translations.en;

    const [isSaved, setIsSaved] = useState(!!initialStudyData);
    const [savedId, setSavedId] = useState(null); // Will be checked on handleWordTap or passed if needed
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // If we opened with initial data, we should still try to find the saved ID 
        // in case the user wants to unsave right away
        const findId = async () => {
            if (initialStudyData && initialSelectedWord) {
                const saveCheck = await checkIsWordStudySaved(
                    currentVerse.verse.book_id,
                    currentVerse.verse.chapter,
                    currentVerse.verse.verse,
                    initialSelectedWord
                );
                if (saveCheck.success) {
                    setSavedId(saveCheck.id);
                }
            }
        };
        findId();
    }, []);

    const handleWordTap = async (word) => {
        if (!word || word.trim() === '') return;
        const cleanedWord = word.replace(/[.,!?;:]/g, '').trim();
        setSelectedWord(cleanedWord);
        setLoading(true);
        setError(null);
        setStudyData(null);

        try {
            const userId = getUserId();
            const result = await getWordStudy(userId, currentVerse.ref, currentVerse.text, currentVerse.originalText, cleanedWord, settings.language);
            if (result.success) {
                setStudyData(result.data);
                // Check if this specific word study is already saved
                const saveCheck = await checkIsWordStudySaved(
                    currentVerse.verse.book_id,
                    currentVerse.verse.chapter,
                    currentVerse.verse.verse,
                    cleanedWord
                );
                if (saveCheck.success) {
                    setIsSaved(saveCheck.saved);
                    setSavedId(saveCheck.id);
                }
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Failed to fetch study data');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSave = async () => {
        if (saving || !studyData || !selectedWord) return;
        setSaving(true);

        try {
            if (isSaved && savedId) {
                const result = await deleteWordStudy(savedId);
                if (result.success) {
                    setIsSaved(false);
                    setSavedId(null);
                }
            } else {
                const studyToSave = {
                    verse_ref: currentVerse.ref,
                    book_id: currentVerse.verse.book_id,
                    chapter: currentVerse.verse.chapter,
                    verse: currentVerse.verse.verse,
                    word: selectedWord,
                    original_word: studyData.word.original,
                    lemma: studyData.word.lemma,
                    transliteration: studyData.word.transliteration,
                    analysis: studyData
                };
                const result = await saveWordStudy(studyToSave);
                if (result.success) {
                    setIsSaved(true);
                    setSavedId(result.data.id);
                }
            }
        } catch (err) {
            console.error('Error toggling save:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleNavigateVerse = async (ref) => {
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch translation
            const targetVersion = settings.language === 'af' ? 'AFR53' : 'KJV';
            const verseRes = await getVerseByReference(ref, targetVersion);
            if (!verseRes.success) throw new Error('Could not find verse');

            const newVerse = verseRes.data;

            // 2. Fetch original text
            const originalRes = await getOriginalVerse(newVerse.book_id, newVerse.chapter, newVerse.verse);
            if (!originalRes.success) throw new Error('Original text not available');

            // 3. Save current to history - INCLUDE current study state
            setHistory(prev => [...prev, {
                verse: currentVerse,
                selectedWord: selectedWord,
                studyData: studyData
            }]);

            // 4. Update current state
            setCurrentVerse({
                verse: newVerse,
                text: newVerse.text,
                ref: `${newVerse.books.name_full} ${newVerse.chapter}:${newVerse.verse}`,
                originalText: originalRes.text,
                originalVersion: originalRes.version
            });

            // 5. Reset study data for new verse
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

        const previousState = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));

        // Restore previous verse and its study state
        setCurrentVerse(previousState.verse);
        setSelectedWord(previousState.selectedWord);
        setStudyData(previousState.studyData);
    };

    return (
        <div className="word-study-overlay">
            <div className="word-study-modal">
                <div className="word-study-header">
                    <div className="ws-header-left">
                        <button className="ws-close-btn" onClick={onClose} title={t.close}>✕</button>
                        {history.length > 0 && (
                            <button className="ws-back-btn" onClick={handleBack} title={t.back}>
                                ← {t.back}
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
                        <p className="ws-instruction">{t.instruction}</p>
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
                                    <div className="ws-word-info">
                                        <h3 className="ws-original">{studyData.word.original}</h3>
                                        <span className="ws-translit">{studyData.word.transliteration}</span>
                                    </div>
                                    <button
                                        className={`ws-save-btn ${isSaved ? 'saved' : ''} ${saving ? 'saving' : ''}`}
                                        onClick={handleToggleSave}
                                        disabled={saving}
                                        title={isSaved ? 'Remove from Profile' : 'Save to Profile'}
                                    >
                                        {saving ? (
                                            <span className="ws-save-spinner">...</span>
                                        ) : isSaved ? (
                                            // Filled Bookmark Icon (Saved)
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21L12 17L5 21Z" />
                                            </svg>
                                        ) : (
                                            // Outline Bookmark Icon (Unsaved)
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M19 21L12 17L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" />
                                            </svg>
                                        )}
                                    </button>
                                    <button
                                        className="ws-save-btn"
                                        onClick={async () => {
                                            if (!studyData) return;
                                            const grammarText = studyData.word?.grammar ?
                                                `${studyData.word.grammar.form || ''}${studyData.word.grammar.linguisticFunction ? ` — ${studyData.word.grammar.linguisticFunction}` : studyData.word.grammar.analysis ? ` — ${studyData.word.grammar.analysis}` : ''}${studyData.word.grammar.contextualSignificance ? `\n  → ${studyData.word.grammar.contextualSignificance}` : ''}`
                                                : '';
                                            const relatedNounText = studyData.word?.relatedNoun ?
                                                `\n${t.relatedNoun}: ${studyData.word.relatedNoun.original} (${studyData.word.relatedNoun.transliteration})${studyData.word.relatedNoun.strongs ? ` ${studyData.word.relatedNoun.strongs}` : ''}${studyData.word.relatedNoun.connection ? `\n  ${studyData.word.relatedNoun.connection}` : ''}`
                                                : '';
                                            const text = `
${t.wordStudy}: ${studyData.word?.original} (${studyData.word?.transliteration})
${t.lemma}: ${studyData.word?.lemma || ''} ${studyData.word?.strongs ? `(${studyData.word.strongs})` : ''}${relatedNounText}
${t.grammar}: ${grammarText}
${t.verse}: ${currentVerse.ref}

${t.contextualMeaning}:
${studyData.word?.contextualMeaning || ''}

${t.whatThisWordDoes}:
${studyData.word?.actionFocus || ''}

${t.lexicalDefinition}:
${studyData.word?.definition || ''}

${t.culturalNuance}:
${studyData.word?.culturalNuance || ''}

${t.theologicalConnection}:
${studyData.word?.theologicalConnection || ''}

${t.relatedVerses}:
${studyData.relatedVerses?.map(v => `- ${v.label}${v.usage ? ` — ${v.usage}` : ''}`).join('\n') || ''}
`.trim();

                                            const copyToClipboard = async (textToCopy) => {
                                                // 1. Try modern API (works on HTTPS/localhost)
                                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                                    try {
                                                        await navigator.clipboard.writeText(textToCopy);
                                                        return true;
                                                    } catch (err) {
                                                        console.warn('Clipboard API failed, trying fallback...', err);
                                                    }
                                                }

                                                // 2. Fallback for HTTP / Older Browsers / WebViews
                                                try {
                                                    const textArea = document.createElement("textarea");
                                                    textArea.value = textToCopy;

                                                    // Ensure valid style so it doesn't break layout but is invisible
                                                    textArea.style.position = "fixed";
                                                    textArea.style.left = "-9999px";
                                                    textArea.style.top = "0";
                                                    textArea.setAttribute('readonly', '');

                                                    document.body.appendChild(textArea);

                                                    // Select text - iOS compat
                                                    textArea.select();
                                                    textArea.setSelectionRange(0, 99999);

                                                    const successful = document.execCommand('copy');
                                                    document.body.removeChild(textArea);

                                                    return successful;
                                                } catch (err) {
                                                    console.error('Copy fallback failed', err);
                                                    return false;
                                                }
                                            };

                                            const success = await copyToClipboard(text);
                                            if (success) {
                                                alert('Copied to clipboard! 📋');
                                            } else {
                                                alert('Could not copy automatically. Please try valid HTTPS context.');
                                            }
                                        }}
                                        title="Copy to Clipboard"
                                        style={{ marginLeft: '8px' }}
                                    >
                                        {/* Copy Icon */}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div className="ws-lemma-row">
                                    <span className="ws-label">{t.lemma}:</span> {studyData.word.lemma}
                                    {studyData.word.strongs && (
                                        <span className="ws-strongs">({studyData.word.strongs})</span>
                                    )}
                                </div>

                                {studyData.word.relatedNoun && (
                                    <div className="ws-related-noun">
                                        <span className="ws-label">{t.relatedNoun}:</span>
                                        <span className="ws-noun-original">{studyData.word.relatedNoun.original}</span>
                                        <span className="ws-noun-translit">({studyData.word.relatedNoun.transliteration})</span>
                                        {studyData.word.relatedNoun.strongs && (
                                            <span className="ws-strongs">{studyData.word.relatedNoun.strongs}</span>
                                        )}
                                        {studyData.word.relatedNoun.connection && (
                                            <p className="ws-noun-connection">{studyData.word.relatedNoun.connection}</p>
                                        )}
                                    </div>
                                )}

                                {studyData.word.grammar && (
                                    <div className="ws-grammar-section">
                                        <div className="ws-grammar-row">
                                            <span className="ws-label">{t.grammar}:</span>
                                            <span className="ws-grammar-form">{studyData.word.grammar.form}</span>
                                        </div>
                                        {(studyData.word.grammar.linguisticFunction || studyData.word.grammar.analysis) && (
                                            <div className="ws-grammar-detail">
                                                <span className="ws-grammar-function">
                                                    {studyData.word.grammar.linguisticFunction || studyData.word.grammar.analysis}
                                                </span>
                                            </div>
                                        )}
                                        {studyData.word.grammar.contextualSignificance && (
                                            <div className="ws-grammar-context">
                                                <em>{studyData.word.grammar.contextualSignificance}</em>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="ws-detail">
                                    <h4>{t.contextualMeaning}</h4>
                                    <p>{studyData.word.contextualMeaning}</p>
                                </div>

                                {studyData.word.actionFocus && (
                                    <div className="ws-detail divider">
                                        <h4>{t.whatThisWordDoes}</h4>
                                        <p>{studyData.word.actionFocus}</p>
                                    </div>
                                )}

                                <div className="ws-detail divider">
                                    <h4>{t.lexicalDefinition}</h4>
                                    <p>{studyData.word.definition}</p>
                                </div>

                                {studyData.word.culturalNuance && (
                                    <div className="ws-detail divider">
                                        <h4>{t.culturalNuance}</h4>
                                        <p>{studyData.word.culturalNuance}</p>
                                    </div>
                                )}

                                {studyData.word.theologicalConnection && (
                                    <div className="ws-detail divider">
                                        <h4>{t.theologicalConnection}</h4>
                                        <p>{studyData.word.theologicalConnection}</p>
                                    </div>
                                )}

                                {studyData.relatedVerses && studyData.relatedVerses.length > 0 && (
                                    <div className="ws-related">
                                        <h4>{t.relatedVerses}</h4>
                                        <div className="ws-related-list">
                                            {studyData.relatedVerses.map((item, idx) => {
                                                const ref = typeof item === 'string' ? item : item.ref;
                                                const label = typeof item === 'string' ? item : item.label;
                                                const usage = typeof item === 'object' ? item.usage : null;
                                                return (
                                                    <div key={idx} className="ws-related-item">
                                                        <button
                                                            className="ws-related-chip"
                                                            onClick={() => handleNavigateVerse(ref)}
                                                        >
                                                            {label}
                                                        </button>
                                                        {usage && <span className="ws-related-usage">— {usage}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!selectedWord && !loading && (
                            <div className="ws-empty-state">
                                <div className="ws-empty-icon">📜</div>
                                <p>{t.emptyState}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WordStudyModal;
