import { useState, useEffect, useCallback } from 'react';
import { useBackButton } from './BackButtonHandler';
import { getChapterSummary } from '../services/aiService';
import { getUserId } from '../services/bibleService';
import { copyToClipboard } from '../utils/appUtils';
import './BibleReader.css'; // Reuse reader styles

function ChapterSummaryModal({ isOpen, onClose, bookName, chapter, verses, language }) {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Close on Android back button
    const handleBackClose = useCallback(() => {
        if (isOpen) onClose();
    }, [isOpen, onClose]);
    useBackButton(isOpen, handleBackClose);

    const t = {
        en: {
            title: 'Chapter Summary',
            loading: 'Generating summary...',
            error: 'Error',
            retry: 'Retry',
            copy: 'Copy',
            copied: 'Copied!',
            summary: 'Summary',
            outline: 'Outline',
            author: 'Author',
            timeframe: 'When written',
            metaNote: 'Traditional and scholarly estimates; dates vary by view.',
            keyPeople: 'Key people',
            keyPlaces: 'Key places',
            noneListed: 'None highlighted in this chapter.'
        },
        af: {
            title: 'Hoofstuk Opsoming',
            loading: 'Genereer opsoming...',
            error: 'Fout',
            retry: 'Probeer weer',
            copy: 'Kopieer',
            copied: 'Gekopieer!',
            summary: 'Opsoming',
            outline: 'Skema',
            author: 'Skrywer',
            timeframe: 'Wanneer geskryf',
            metaNote: 'Tradisionele en wetenskaplike skattings; datums wissel.',
            keyPeople: 'Belangrike mense',
            keyPlaces: 'Belangrike plekke',
            noneListed: 'Geen uitgelig in hierdie hoofstuk nie.'
        }
    }[language] || {
        title: 'Chapter Summary',
        loading: 'Generating summary...',
        error: 'Error',
        retry: 'Retry',
        copy: 'Copy',
        copied: 'Copied!',
        summary: 'Summary',
        outline: 'Outline',
        author: 'Author',
        timeframe: 'When written',
        metaNote: 'Traditional and scholarly estimates; dates vary by view.',
        keyPeople: 'Key people',
        keyPlaces: 'Key places',
        noneListed: 'None highlighted in this chapter.'
    };

    const renderKeyList = (items) => {
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) {
            return <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.75 }}>{t.noneListed}</p>;
        }
        return (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55, fontSize: '0.9rem' }}>
                {list.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
            </ul>
        );
    };

    useEffect(() => {
        if (isOpen && bookName && chapter) {
            fetchSummary();
        }
    }, [isOpen, bookName, chapter]);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const userId = await getUserId();
            const result = await getChapterSummary(userId, bookName, chapter, verses, language);
            if (result.success) {
                setSummaryData(result.data);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Failed to generate summary. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!summaryData) return;

        const outlineText = (summaryData.outline || [])
            .map(item => `${item.range}: ${item.title}`)
            .join('\n');

        const metaLines = [];
        if (summaryData.author) metaLines.push(`${t.author}: ${summaryData.author}`);
        if (summaryData.timeframe) metaLines.push(`${t.timeframe}: ${summaryData.timeframe}`);
        const people = summaryData.keyPeople || [];
        const places = summaryData.keyPlaces || [];
        if (people.length) {
            metaLines.push(`${t.keyPeople}:\n${people.map((p) => `• ${p}`).join('\n')}`);
        }
        if (places.length) {
            metaLines.push(`${t.keyPlaces}:\n${places.map((p) => `• ${p}`).join('\n')}`);
        }
        const metaBlock = metaLines.length ? `${metaLines.join('\n\n')}\n\n` : '';

        const fullText = `${bookName} ${chapter} Summary\n\n${metaBlock}${summaryData.summary}\n\nOutline:\n${outlineText}`;

        copyToClipboard(fullText).then(success => {
            if (success) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="book-selector-modal" onClick={onClose}>
            <div className="book-selector-content info-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t.title} 📝</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body info-body">
                    {loading ? (
                        <div className="loading-state">
                            <div className="loading-spinner"></div>
                            <p>{t.loading}</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            <p>{error}</p>
                            <button className="btn-primary" onClick={fetchSummary}>{t.retry}</button>
                        </div>
                    ) : (
                        <div className="summary-content">
                            {(summaryData.author || summaryData.timeframe) && (
                                <div
                                    className="info-section chapter-meta-block"
                                    style={{
                                        marginBottom: '1rem',
                                        paddingBottom: '12px',
                                        borderBottom: '1px solid var(--border-color)'
                                    }}
                                >
                                    {summaryData.author && (
                                        <p style={{ margin: '0 0 8px', lineHeight: 1.5, fontSize: '0.95rem' }}>
                                            <span className="info-label" style={{ display: 'block', marginBottom: '4px' }}>
                                                {t.author}
                                            </span>
                                            {summaryData.author}
                                        </p>
                                    )}
                                    {summaryData.timeframe && (
                                        <p style={{ margin: 0, lineHeight: 1.5, fontSize: '0.95rem' }}>
                                            <span className="info-label" style={{ display: 'block', marginBottom: '4px' }}>
                                                {t.timeframe}
                                            </span>
                                            {summaryData.timeframe}
                                        </p>
                                    )}
                                    <p
                                        style={{
                                            margin: '10px 0 0',
                                            fontSize: '0.75rem',
                                            opacity: 0.65,
                                            lineHeight: 1.4
                                        }}
                                    >
                                        {t.metaNote}
                                    </p>
                                </div>
                            )}
                            <div
                                className="info-section"
                                style={{
                                    marginBottom: '1rem',
                                    paddingBottom: '12px',
                                    borderBottom: '1px solid var(--border-color)'
                                }}
                            >
                                <span className="info-label" style={{ display: 'block', marginBottom: '6px' }}>
                                    {t.keyPeople}
                                </span>
                                {renderKeyList(summaryData.keyPeople)}
                                <span className="info-label" style={{ display: 'block', margin: '12px 0 6px' }}>
                                    {t.keyPlaces}
                                </span>
                                {renderKeyList(summaryData.keyPlaces)}
                            </div>
                            <div className="info-section">
                                <span className="info-label">{t.summary}</span>
                                <p className="summary-text" style={{ lineHeight: '1.6' }}>
                                    {summaryData.summary}
                                </p>
                            </div>

                            <div className="info-section">
                                <span className="info-label">{t.outline}</span>
                                <div className="outline-list">
                                    {(summaryData.outline || []).map((item, idx) => (
                                        <div key={idx} className="outline-item" style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                                            <span style={{ fontWeight: 'bold', minWidth: '50px', color: 'var(--theme-color)' }}>{item.range}</span>
                                            <span>{item.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {!loading && !error && (
                    <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={handleCopy}>
                            {copied ? `✅ ${t.copied}` : `📋 ${t.copy}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChapterSummaryModal;
