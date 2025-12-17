/**
 * Profile Page - User's highlights, notes, studies, and profile picture
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllHighlights, getAllNotes, getStudyCollections, getLabels, removeHighlight, deleteNote, deleteStudyCollection, HIGHLIGHT_COLORS } from '../services/highlightService';
import { getBooks, getVersions } from '../services/bibleService';
import { isVersionDownloaded, getDownloadedVersions, downloadVersion, deleteOfflineVersion, getStorageUsage, formatBytes } from '../services/offlineService';
import { useSettings } from '../context/SettingsContext';
import './Profile.css';

function Profile() {
    const navigate = useNavigate();
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState('highlights');
    const [highlights, setHighlights] = useState([]);
    const [notes, setNotes] = useState([]);
    const [studies, setStudies] = useState([]);
    const [labels, setLabels] = useState([]);
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Profile settings (stored locally)
    const [profilePic, setProfilePic] = useState(localStorage.getItem('profile_picture') || null);
    const [displayName, setDisplayName] = useState(localStorage.getItem('display_name') || 'My Profile');
    const [editingName, setEditingName] = useState(false);

    // Confirm delete dialog
    const [confirmDelete, setConfirmDelete] = useState({ show: false, type: '', id: null, name: '' });

    // Downloads state
    const [versions, setVersions] = useState([]);
    const [downloadedVersions, setDownloadedVersions] = useState([]);
    const [downloadProgress, setDownloadProgress] = useState({});
    const [storageUsage, setStorageUsage] = useState('0 B');
    const [selectedStudyId, setSelectedStudyId] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [highlightRes, noteRes, studyRes, labelRes, bookRes] = await Promise.all([
            getAllHighlights(),
            getAllNotes(),
            getStudyCollections(),
            getLabels(),
            getBooks()
        ]);

        if (highlightRes.success) setHighlights(highlightRes.highlights);
        if (noteRes.success) setNotes(noteRes.notes);
        if (studyRes.success) setStudies(studyRes.collections);
        if (labelRes.success) setLabels(labelRes.labels);
        if (bookRes.success) setBooks(bookRes.data.all || []);

        // Load versions and download status
        const versionsRes = await getVersions();
        if (versionsRes.success) setVersions(versionsRes.data);

        const downloaded = await getDownloadedVersions();
        setDownloadedVersions(downloaded);

        const usage = await getStorageUsage();
        setStorageUsage(usage.formatted);

        setLoading(false);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions for profile pic
                const MAX_SIZE = 300;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    localStorage.setItem('profile_picture', compressedBase64);
                    setProfilePic(compressedBase64);
                } catch (err) {
                    alert('Image is still too large for storage. Please try a different one.');
                    console.error('Storage error:', err);
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const saveDisplayName = () => {
        localStorage.setItem('display_name', displayName);
        setEditingName(false);
    };

    const getBookName = (bookId) => {
        const book = books.find(b => b.id === bookId);
        return book?.name_full || bookId;
    };

    const getColorName = (colorHex) => {
        const found = HIGHLIGHT_COLORS.find(c => c.color === colorHex);
        return found?.name || 'custom';
    };

    const navigateToVerse = (bookId, chapter, verse) => {
        navigate('/bible', {
            state: {
                bookId,
                chapter,
                targetVerse: verse
            }
        });
    };

    // Delete handlers
    const openDeleteConfirm = (type, id, name, e) => {
        e.stopPropagation();
        setConfirmDelete({ show: true, type, id, name });
    };

    const handleConfirmDelete = async () => {
        const { type, id } = confirmDelete;
        let success = false;

        if (type === 'highlight') {
            const h = highlights.find(h => h.id === id);
            if (h) {
                const result = await removeHighlight(h.book_id, h.chapter, h.verse, h.version);
                success = result.success;
                if (success) setHighlights(highlights.filter(x => x.id !== id));
            }
        } else if (type === 'note') {
            const result = await deleteNote(id);
            success = result.success;
            if (success) setNotes(notes.filter(x => x.id !== id));
        } else if (type === 'study') {
            const result = await deleteStudyCollection(id);
            success = result.success;
            if (success) setStudies(studies.filter(x => x.id !== id));
        }

        setConfirmDelete({ show: false, type: '', id: null, name: '' });
    };

    const cancelDelete = () => {
        setConfirmDelete({ show: false, type: '', id: null, name: '' });
    };

    const tabs = [
        { id: 'highlights', label: '📌 Highlights', count: highlights.length },
        { id: 'notes', label: '📝 Notes', count: notes.length },
        { id: 'studies', label: '📚 Studies', count: studies.length },
        { id: 'downloads', label: '📥 Downloads', count: downloadedVersions.length },
    ];

    // Download handlers
    const handleDownload = async (versionId) => {
        setDownloadProgress(prev => ({ ...prev, [versionId]: 0 }));

        const result = await downloadVersion(versionId, (progress) => {
            setDownloadProgress(prev => ({ ...prev, [versionId]: progress }));
        });

        if (result.success) {
            const downloaded = await getDownloadedVersions();
            setDownloadedVersions(downloaded);
            const usage = await getStorageUsage();
            setStorageUsage(usage.formatted);
        }

        setDownloadProgress(prev => {
            const updated = { ...prev };
            delete updated[versionId];
            return updated;
        });
    };

    const handleDeleteDownload = async (versionId) => {
        await deleteOfflineVersion(versionId);
        const downloaded = await getDownloadedVersions();
        setDownloadedVersions(downloaded);
        const usage = await getStorageUsage();
        setStorageUsage(usage.formatted);
    };

    const isDownloaded = (versionId) => {
        return downloadedVersions.some(v => v.version_id === versionId);
    };

    const getDownloadInfo = (versionId) => {
        return downloadedVersions.find(v => v.version_id === versionId);
    };

    return (
        <div className="profile-page">
            {/* Header with profile picture */}
            <div className="profile-header">
                <div className="profile-pic-container">
                    <label className="profile-pic-upload">
                        {profilePic ? (
                            <img src={profilePic} alt="Profile" className="profile-pic" />
                        ) : (
                            <div className="profile-pic-placeholder">👤</div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            hidden
                        />
                        <span className="edit-pic-overlay">📷</span>
                    </label>
                </div>

                {editingName ? (
                    <div className="name-edit-row">
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="name-input"
                            autoFocus
                        />
                        <button className="save-name-btn" onClick={saveDisplayName}>✓</button>
                    </div>
                ) : (
                    <h1 className="profile-name" onClick={() => setEditingName(true)}>
                        {displayName}
                        <span className="edit-icon">✏️</span>
                    </h1>
                )}

                <div className="language-selector">
                    <span className="lang-label">For You Content in Afr / Eng</span>
                    <div className="lang-toggle-container">
                        <button
                            className={`lang-btn ${settings.language === 'en' ? 'active' : ''}`}
                            onClick={() => updateSettings({ language: 'en' })}
                        >
                            English
                        </button>
                        <button
                            className={`lang-btn ${settings.language === 'af' ? 'active' : ''}`}
                            onClick={() => updateSettings({ language: 'af' })}
                        >
                            Afrikaans
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="profile-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id !== 'notes') setSelectedStudyId(null); // Clear filter when leaving notes context (optional, but good UX)
                        }}
                    >
                        {tab.label} <span className="tab-count">{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="profile-content">
                {loading ? (
                    <div className="loading-state">Loading...</div>
                ) : (
                    <>
                        {/* Highlights Tab */}
                        {activeTab === 'highlights' && (
                            <div className="highlights-list">
                                {highlights.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No highlights yet</p>
                                        <p className="empty-hint">Tap on a verse while reading to add highlights</p>
                                    </div>
                                ) : (
                                    highlights.map(h => (
                                        <div
                                            key={h.id}
                                            className="highlight-item"
                                            onClick={() => navigateToVerse(h.book_id, h.chapter, h.verse)}
                                        >
                                            <div
                                                className="highlight-color-dot"
                                                style={{ backgroundColor: h.color }}
                                            />
                                            <div className="highlight-info">
                                                <span className="highlight-ref">
                                                    {getBookName(h.book_id)} {h.chapter}:{h.verse}
                                                </span>
                                                <span className="highlight-version">{h.version}</span>
                                            </div>
                                            <button
                                                className="delete-btn"
                                                onClick={(e) => openDeleteConfirm('highlight', h.id, `${getBookName(h.book_id)} ${h.chapter}:${h.verse}`, e)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Notes Tab */}
                        {activeTab === 'notes' && (
                            <div className="notes-list">
                                {selectedStudyId && (
                                    <div className="filter-banner">
                                        <span>
                                            Filtering by study: <strong>{studies.find(s => s.id === selectedStudyId)?.name}</strong>
                                        </span>
                                        <button onClick={() => setSelectedStudyId(null)}>Clear Filter</button>
                                    </div>
                                )}
                                {(selectedStudyId ? notes.filter(n => n.study_id === selectedStudyId) : notes).length === 0 ? (
                                    <div className="empty-state">
                                        <p>No notes yet</p>
                                        <p className="empty-hint">Add notes to verses for personal study</p>
                                    </div>
                                ) : (
                                    (selectedStudyId ? notes.filter(n => n.study_id === selectedStudyId) : notes).map(note => (
                                        <div
                                            key={note.id}
                                            className="note-item"
                                            onClick={() => navigateToVerse(note.book_id, note.chapter, note.verse)}
                                        >
                                            <div className="note-ref">
                                                {getBookName(note.book_id)} {note.chapter}:{note.verse}
                                            </div>
                                            <p className="note-text-preview">{note.note_text}</p>
                                            <div className="note-footer">
                                                {note.study_collections && (
                                                    <span
                                                        className="note-study-badge"
                                                        style={{ backgroundColor: note.study_collections.color }}
                                                    >
                                                        {note.study_collections.name}
                                                    </span>
                                                )}
                                                <button
                                                    className="delete-btn"
                                                    onClick={(e) => openDeleteConfirm('note', note.id, `${getBookName(note.book_id)} ${note.chapter}:${note.verse}`, e)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Studies Tab */}
                        {activeTab === 'studies' && (
                            <div className="studies-list">
                                {studies.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No study collections yet</p>
                                        <p className="empty-hint">Create a study when adding notes to group related scriptures</p>
                                    </div>
                                ) : (
                                    studies.map(study => {
                                        const studyNotes = notes.filter(n => n.study_id === study.id);
                                        return (
                                            <div
                                                key={study.id}
                                                className="study-item"
                                                onClick={() => {
                                                    setSelectedStudyId(study.id);
                                                    setActiveTab('notes');
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div
                                                    className="study-color-bar"
                                                    style={{ backgroundColor: study.color }}
                                                />
                                                <div className="study-info">
                                                    <h3>{study.name}</h3>
                                                    {study.description && <p>{study.description}</p>}
                                                    <span className="study-count">{studyNotes.length} notes</span>
                                                </div>
                                                <button
                                                    className="delete-btn"
                                                    onClick={(e) => openDeleteConfirm('study', study.id, study.name, e)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Downloads Tab */}
                        {activeTab === 'downloads' && (
                            <div className="downloads-list">
                                <div className="storage-info">
                                    <span>💾 Storage used: {storageUsage}</span>
                                </div>

                                {versions.map(version => {
                                    const downloaded = isDownloaded(version.id);
                                    const info = getDownloadInfo(version.id);
                                    const progress = downloadProgress[version.id];
                                    const isDownloading = progress !== undefined;

                                    return (
                                        <div key={version.id} className="download-item">
                                            <div className="download-status">
                                                {downloaded ? '✅' : '⬜'}
                                            </div>
                                            <div className="download-info">
                                                <span className="download-name">{version.name}</span>
                                                <span className="download-abbrev">{version.abbreviation}</span>
                                                {downloaded && info && (
                                                    <span className="download-size">
                                                        {formatBytes(info.size_bytes)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="download-actions">
                                                {isDownloading ? (
                                                    <div className="download-progress">
                                                        <div
                                                            className="progress-bar"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                        <span className="progress-text">{progress}%</span>
                                                    </div>
                                                ) : downloaded ? (
                                                    <button
                                                        className="delete-download-btn"
                                                        onClick={() => handleDeleteDownload(version.id)}
                                                    >
                                                        🗑️
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="download-btn"
                                                        onClick={() => handleDownload(version.id)}
                                                    >
                                                        ⬇️ Download
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                <p className="download-hint">
                                    Downloaded versions are available offline
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Confirm Delete Modal */}
            {confirmDelete.show && (
                <div className="confirm-modal-overlay" onClick={cancelDelete}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete {confirmDelete.type}?</h3>
                        <p>Are you sure you want to delete this {confirmDelete.type}?</p>
                        <p className="confirm-item-name">"{confirmDelete.name}"</p>
                        <div className="confirm-buttons">
                            <button className="cancel-btn" onClick={cancelDelete}>Cancel</button>
                            <button className="delete-confirm-btn" onClick={handleConfirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;
