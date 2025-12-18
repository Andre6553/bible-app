import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInductiveStudies, deleteInductiveStudy } from '../services/studyService';
import { getLocalizedBookName } from '../constants/bookNames';
import { useSettings } from '../context/SettingsContext';
import './Study.css';

function Study() {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadStudies();
    }, []);

    const loadStudies = async () => {
        setLoading(true);
        const result = await getInductiveStudies();
        if (result.success) {
            setStudies(result.studies);
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this study?')) {
            const result = await deleteInductiveStudy(id);
            if (result.success) {
                setStudies(studies.filter(s => s.id !== id));
            }
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString(settings.language === 'af' ? 'af-ZA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const translations = {
        en: {
            title: '📖 Bible Study',
            subtitle: 'Deeper exploration through the Inductive Method',
            newStudy: 'New Study',
            noStudies: 'No studies yet. Start one from the Bible reader!',
            observation: 'Observation',
            interpretation: 'Interpretation',
            application: 'Application'
        },
        af: {
            title: '📖 Bybelstudie',
            subtitle: 'Dieper ondersoek deur die Induktiewe Metode',
            newStudy: 'Nuwe Studie',
            noStudies: 'Geen studies nog nie. Begin een vanaf die Bybelleser!',
            observation: 'Waarneming',
            interpretation: 'Interpretasie',
            application: 'Toepassing'
        }
    };

    const t = translations[settings.language] || translations.en;

    return (
        <div className="study-container">
            <header className="study-header">
                <h1>{t.title}</h1>
                <p className="subtitle">{t.subtitle}</p>
            </header>

            <div className="study-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading your studies...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <p>⚠️ {error}</p>
                        <button onClick={loadStudies}>Retry</button>
                    </div>
                ) : studies.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">✍️</div>
                        <p>{t.noStudies}</p>
                        <div className="start-small-tip">
                            <p>💡 <strong>Tip:</strong> {settings.language === 'af' ? 'Begin klein! Bestudeer \'n kort boek soos Jakobus of Filippense.' : 'Start small! Try studying a short book like James or Philippians.'}</p>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/bible')}>
                            Go to Bible
                        </button>
                    </div>
                ) : (
                    <div className="studies-list">
                        {studies.map(study => (
                            <div
                                key={study.id}
                                className="study-card"
                                onClick={() => navigate(`/study/${study.id}`)}
                            >
                                <div className="study-card-header">
                                    <h3>{study.title || `${getLocalizedBookName(study.book_name || 'Book', settings.language)} ${study.chapter}:${study.verse_start}`}</h3>
                                    <button
                                        className="delete-study-btn"
                                        onClick={(e) => handleDelete(e, study.id)}
                                    >✕</button>
                                </div>
                                <div className="study-card-meta">
                                    <span>📅 {formatDate(study.updated_at)}</span>
                                    <span>📍 {getLocalizedBookName(study.book_name || 'Book', settings.language)} {study.chapter}:{study.verse_start}</span>
                                </div>

                                {study.application?.action && (
                                    <div className="study-card-action">
                                        <span className="action-dot"></span>
                                        <p>{study.application.action}</p>
                                    </div>
                                )}

                                <div className="study-card-progress">
                                    <div className={`progress-dot ${study.observation?.what ? 'complete' : ''}`} title={t.observation}></div>
                                    <div className={`progress-dot ${study.interpretation?.meaning ? 'complete' : ''}`} title={t.interpretation}></div>
                                    <div className={`progress-dot ${study.application?.action ? 'complete' : ''}`} title={t.application}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Study;
