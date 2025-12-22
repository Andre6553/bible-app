import { useState, useEffect } from 'react';
import { getChapterSummary } from '../services/aiService';
import { getUserId } from '../services/bibleService';
import './BibleReader.css'; // Reuse reader styles

function ChapterSummaryModal({ isOpen, onClose, bookName, chapter, verses, language }) {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

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

        const outlineText = summaryData.outline
            .map(item => `${item.range}: ${item.title}`)
            .join('\n');

        const fullText = `${bookName} ${chapter} Summary\n\n${summaryData.summary}\n\nOutline:\n${outlineText}`;

        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    const t = {
        en: {
            title: 'Chapter Summary',
            loading: 'Generating summary...',
            error: 'Error',
            retry: 'Retry',
            copy: 'Copy',
            copied: 'Copied!',
            summary: 'Summary',
            outline: 'Outline'
        },
        af: {
            title: 'Hoofstuk Opsoming',
            loading: 'Genereer opsoming...',
            error: 'Fout',
            retry: 'Probeer weer',
            copy: 'Kopieer',
            copied: 'Gekopieer!',
            summary: 'Opsoming',
            outline: 'Skema'
        }
    }[language] || {
        en: {
            title: 'Chapter Summary',
            loading: 'Generating summary...',
            error: 'Error',
            retry: 'Retry',
            copy: 'Copy',
            copied: 'Copied!',
            summary: 'Summary',
            outline: 'Outline'
        },
        af: {
            title: 'Hoofstuk Opsoming',
            loading: 'Genereer opsoming...',
            error: 'Fout',
            retry: 'Probeer weer',
            copy: 'Kopieer',
            copied: 'Gekopieer!',
            summary: 'Opsoming',
            outline: 'Skema'
        }
    }.en;

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
                            <div className="info-section">
                                <span className="info-label">{t.summary}</span>
                                <p className="summary-text" style={{ lineHeight: '1.6' }}>
                                    {summaryData.summary}
                                </p>
                            </div>

                            <div className="info-section">
                                <span className="info-label">{t.outline}</span>
                                <div className="outline-list">
                                    {summaryData.outline.map((item, idx) => (
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
