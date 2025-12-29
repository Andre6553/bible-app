import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInductiveStudies, deleteInductiveStudy } from '../services/studyService';
import { getLocalizedBookName } from '../constants/bookNames';
import { useSettings } from '../context/SettingsContext';
import { logActivity } from '../services/bibleService';
import './Study.css';

function Study() {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null, title: '' });
    const [isDeleting, setIsDeleting] = useState(false);

    // Prevent double logging in strict mode
    const loggingRef = useRef(false);

    useEffect(() => {
        if (!loggingRef.current) {
            logActivity('study_page_visit');
            loggingRef.current = true;
        }
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

    const openDeleteConfirm = (e, study) => {
        e.stopPropagation();
        e.preventDefault();
        const title = study.title || `${getLocalizedBookName(study.book_name || 'Book', settings.language)} ${study.chapter}:${study.verse_start}`;
        setConfirmDelete({ show: true, id: study.id, title });
    };

    const cancelDelete = () => {
        setConfirmDelete({ show: false, id: null, title: '' });
    };

    const handleConfirmDelete = async () => {
        const { id } = confirmDelete;
        if (!id) return;

        setIsDeleting(true);
        try {
            const result = await deleteInductiveStudy(id);

            if (result.success) {
                setStudies(prev => prev.filter(s => s.id !== id));
                setConfirmDelete({ show: false, id: null, title: '' });
            } else {
                alert(`Failed to delete: ${result.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsDeleting(false);
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
                                        onClick={(e) => openDeleteConfirm(e, study)}
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

            {/* Confirm Delete Modal */}
            {confirmDelete.show && (
                <div className="confirm-modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete <strong>{confirmDelete.title}</strong>?</p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={cancelDelete} disabled={isDeleting}>Cancel</button>
                            <button
                                className="confirm-delete-btn"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Study;
