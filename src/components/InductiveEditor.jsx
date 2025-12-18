import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getStudyById, saveInductiveStudy } from '../services/studyService';
import { getInductiveStudyHints } from '../services/aiService';
import { getLocalizedBookName } from '../constants/bookNames';
import { getUserId } from '../services/bibleService';
import { useSettings } from '../context/SettingsContext';
import './Study.css';

function InductiveEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();

    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [study, setStudy] = useState({
        title: '',
        book_id: null,
        book_name: '',
        chapter: 1,
        verse_start: 1,
        verse_end: 1,
        observation: {
            who: '',
            what: '',
            where: '',
            when: '',
            why: '',
            how: '',
            keywords: '',
            commands: '',
            promises: '',
            contrasts: '',
            patterns: ''
        },
        interpretation: {
            author: '',
            audience: '',
            purpose: '',
            context: '',
            meaning: '',
            crossRefs: ''
        },
        application: {
            god: '',
            myself: '',
            change: '',
            action: ''
        }
    });

    useEffect(() => {
        if (id && id !== 'new') {
            loadStudy();
        } else if (location.state) {
            // New study from Bible reader
            const { bookId, bookName, chapter, verse } = location.state;
            setStudy(prev => ({
                ...prev,
                book_id: bookId,
                book_name: bookName,
                chapter: chapter,
                verse_start: verse,
                verse_end: verse,
                title: `${getLocalizedBookName(bookName, settings.language)} ${chapter}:${verse}`
            }));
            setLoading(false);
        } else {
            setLoading(false);
        }
    }, [id]);

    const loadStudy = async () => {
        setLoading(true);
        const result = await getStudyById(id);
        if (result.success) {
            setStudy(result.study);
        }
        setLoading(false);
    };

    const [aiLoading, setAiLoading] = useState(false);

    const handleGetAiHints = async () => {
        const userId = await getUserId();
        if (!userId) {
            alert('Please sign in to use AI assistance');
            return;
        }

        setAiLoading(true);
        const result = await getInductiveStudyHints(
            userId,
            step,
            study.book_name,
            study.chapter,
            study.verse_start,
            study.verse_end,
            settings.language
        );

        if (result.success) {
            const h = result.hints;
            if (step === 1) {
                setStudy(prev => ({
                    ...prev,
                    observation: {
                        ...prev.observation,
                        who: h.who || prev.observation.who,
                        what: h.what || prev.observation.what,
                        where: h.where || prev.observation.where,
                        keywords: Array.isArray(h.keywords) ? h.keywords.join(', ') : h.keywords || prev.observation.keywords,
                        commands: h.commands || prev.observation.commands,
                        promises: h.promises || prev.observation.promises
                    }
                }));
            } else if (step === 2) {
                setStudy(prev => ({
                    ...prev,
                    interpretation: {
                        ...prev.interpretation,
                        author: h.author || prev.interpretation.author,
                        context: h.context || prev.interpretation.context,
                        meaning: h.meaning || prev.interpretation.meaning,
                        crossRefs: h.crossRefs || prev.interpretation.crossRefs
                    }
                }));
            } else if (step === 3) {
                setStudy(prev => ({
                    ...prev,
                    application: {
                        ...prev.application,
                        god: h.god || prev.application.god,
                        myself: h.myself || prev.application.myself,
                        change: h.change || prev.application.change,
                        action: h.action || prev.application.action
                    }
                }));
            }
        } else {
            alert('AI Assistance failed: ' + result.error);
        }
        setAiLoading(false);
    };

    const handleSave = async () => {
        const result = await saveInductiveStudy(study);
        if (result.success) {
            navigate('/study');
        } else {
            alert('Failed to save study: ' + result.error);
        }
    };

    const updateObservation = (field, value) => {
        setStudy(prev => ({
            ...prev,
            observation: { ...prev.observation, [field]: value }
        }));
    };

    const updateInterpretation = (field, value) => {
        setStudy(prev => ({
            ...prev,
            interpretation: { ...prev.interpretation, [field]: value }
        }));
    };

    const updateApplication = (field, value) => {
        setStudy(prev => ({
            ...prev,
            application: { ...prev.application, [field]: value }
        }));
    };

    const addKeyword = (word) => {
        if (!word) return;
        const current = study.observation.keywords ? study.observation.keywords.split(',').map(k => k.trim()) : [];
        if (!current.includes(word)) {
            const next = [...current, word].join(', ');
            updateObservation('keywords', next);
        }
    };

    const removeKeyword = (word) => {
        const current = study.observation.keywords ? study.observation.keywords.split(',').map(k => k.trim()) : [];
        const next = current.filter(k => k !== word).join(', ');
        updateObservation('keywords', next);
    };

    const translations = {
        en: {
            observation: '1. Observation',
            interpretation: '2. Interpretation',
            application: '3. Application',
            next: 'Next',
            back: 'Back',
            save: 'Save Study',
            who: 'Who is involved? (Speakers/Audience)',
            what: 'What is happening in this passage?',
            where: 'Where/When does it take place?',
            keywords: 'Key Words & Repeated Themes',
            commands: 'Commands & Warnings',
            promises: 'Promises of God',
            patterns: 'Patterns (Cause & Effect)',
            meaning: 'Interpretation & Meaning',
            originalMessage: 'Original Message & Context',
            context: 'Historical/Cultural Background',
            crossRefs: 'Scripture interprets Scripture (Refs)',
            god: 'What does this teach me about God?',
            myself: 'What does it show me about myself?',
            change: 'What do I need to change?',
            action: 'One Clear Action Step (Today I will...)',
            aiHint: '✨ AI Magic Hint',
            aiLoading: 'Asking AI...'
        },
        af: {
            observation: '1. Waarneming',
            interpretation: '2. Interpretasie',
            application: '3. Toepassing',
            next: 'Volgende',
            back: 'Terug',
            save: 'Stoor Studie',
            who: 'Wie is betrokke? (Sprekers/Gehoor)',
            what: 'Wat gebeur in hierdie teks?',
            where: 'Waar/Wanneer vind dit plaas?',
            keywords: 'Sleutelwoorde & Herhalende Temas',
            commands: 'Bevels & Waarskuwings',
            promises: 'Beloftes van God',
            patterns: 'Patrone (Oorsaak & Gevolg)',
            meaning: 'Interpretasie & Betekenis',
            originalMessage: 'Oorspronklike Boodskap & Konteks',
            context: 'Historiese/Kulturele Agtergrond',
            crossRefs: 'Geskrif verklaar Geskrif (Verwysings)',
            god: 'Wat vertel dit my van God?',
            myself: 'Wat wys dit my van myself?',
            change: 'Wat moet ek verander?',
            action: 'Een Duidelike Aksie-stap (Vandag sal ek...)',
            aiHint: '✨ KI Magiese Wenk',
            aiLoading: 'Vra KI...'
        }
    };

    const t = translations[settings.language] || translations.en;

    if (loading) return <div className="loading-state"><div className="loading-spinner"></div></div>;

    return (
        <div className="editor-container">
            <header className="editor-header">
                <button className="back-btn" onClick={() => navigate('/study')}>‹</button>
                <h2>{study.title}</h2>
            </header>

            <div className="editor-steps">
                <div className={`step-item ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>{t.observation}</div>
                <div className={`step-item ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>{t.interpretation}</div>
                <div className={`step-item ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>{t.application}</div>
            </div>

            <button
                className={`ai-assist-btn ${aiLoading ? 'loading' : ''}`}
                onClick={handleGetAiHints}
                disabled={aiLoading}
            >
                {aiLoading ? (
                    <>
                        <span className="ai-spinner">✨</span>
                        {t.aiLoading}
                    </>
                ) : t.aiHint}
            </button>

            <div className="editor-fields">
                {step === 1 && (
                    <div className="step-content">
                        <div className="field-group">
                            <label>{t.who}</label>
                            <input className="editor-input" value={study.observation.who || ''} onChange={(e) => updateObservation('who', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.what}</label>
                            <textarea className="editor-textarea" value={study.observation.what || ''} onChange={(e) => updateObservation('what', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.where}</label>
                            <input className="editor-input" value={study.observation.where || ''} onChange={(e) => updateObservation('where', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.keywords}</label>
                            <div className="tag-input-container">
                                <div className="tags-list">
                                    {(study.observation.keywords || '').split(',').filter(Boolean).map((tag, i) => (
                                        <span key={i} className="keyword-tag">
                                            {tag.trim()}
                                            <button className="remove-tag" onClick={() => removeKeyword(tag.trim())}>✕</button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    className="editor-input"
                                    placeholder="Type and press Enter..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addKeyword(e.target.value.trim());
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div className="field-group">
                            <label>{t.commands}</label>
                            <input className="editor-input" value={study.observation.commands || ''} onChange={(e) => updateObservation('commands', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.promises}</label>
                            <input className="editor-input" value={study.observation.promises || ''} onChange={(e) => updateObservation('promises', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.patterns}</label>
                            <textarea className="editor-textarea" placeholder="e.g. Cause and Effect" value={study.observation.patterns || ''} onChange={(e) => updateObservation('patterns', e.target.value)} />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        <div className="field-group">
                            <label>{t.originalMessage}</label>
                            <textarea className="editor-textarea" value={study.interpretation.author || ''} onChange={(e) => updateInterpretation('author', e.target.value)} placeholder="Who wrote this? For whom?" />
                        </div>
                        <div className="field-group">
                            <label>{t.context}</label>
                            <textarea className="editor-textarea" value={study.interpretation.context || ''} onChange={(e) => updateInterpretation('context', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.meaning}</label>
                            <textarea
                                className="editor-textarea"
                                style={{ minHeight: '200px' }}
                                value={study.interpretation.meaning || ''}
                                onChange={(e) => updateInterpretation('meaning', e.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label>{t.crossRefs}</label>
                            <input className="editor-input" value={study.interpretation.crossRefs || ''} onChange={(e) => updateInterpretation('crossRefs', e.target.value)} />
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="step-content">
                        <div className="field-group">
                            <label>{t.god}</label>
                            <textarea className="editor-textarea" value={study.application.god || ''} onChange={(e) => updateApplication('god', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.myself}</label>
                            <textarea className="editor-textarea" value={study.application.myself || ''} onChange={(e) => updateApplication('myself', e.target.value)} />
                        </div>
                        <div className="field-group">
                            <label>{t.change}</label>
                            <textarea className="editor-textarea" value={study.application.change || ''} onChange={(e) => updateApplication('change', e.target.value)} />
                        </div>
                        <div className="field-group standout">
                            <label>{t.action}</label>
                            <input className="editor-input action-input" value={study.application.action || ''} onChange={(e) => updateApplication('action', e.target.value)} placeholder="Today I will..." />
                        </div>
                    </div>
                )}
            </div>

            <div className="editor-footer">
                {step > 1 ? (
                    <button className="btn-secondary" onClick={() => setStep(step - 1)}>{t.back}</button>
                ) : <div></div>}

                {step < 3 ? (
                    <button className="btn-primary" onClick={() => setStep(step + 1)}>{t.next}</button>
                ) : (
                    <button className="btn-primary" onClick={handleSave}>{t.save}</button>
                )}
            </div>
        </div>
    );
}

export default InductiveEditor;
