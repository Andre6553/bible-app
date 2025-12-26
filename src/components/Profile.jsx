/**
 * Profile Page - User's highlights, notes, studies, and profile picture
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllNotes, getStudyCollections, getLabels, removeHighlight, deleteNote, deleteStudyCollection, HIGHLIGHT_COLORS, getHighlightCategories, deleteCategory, getHighlightsByColors, deleteHighlightsByIds, fetchHighlightTexts } from '../services/highlightService';
import { getBooks, getVersions } from '../services/bibleService';
import { getLocalizedBookName } from '../constants/bookNames';
import { isVersionDownloaded, getDownloadedVersions, downloadVersion, deleteOfflineVersion, getStorageUsage, formatBytes } from '../services/offlineService';
import { getSavedWordStudies, deleteWordStudy as removeSavedWordStudy } from '../services/wordStudyService';
import WordStudyModal from './WordStudyModal';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
import { migrateAnonymousData, checkIfMigrationNeeded } from '../services/migrationService';
import './Profile.css';

function Profile() {
    const navigate = useNavigate();
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState('highlights');
    const [highlights, setHighlights] = useState([]);
    const [notes, setNotes] = useState([]);
    const [studies, setStudies] = useState([]);
    const [wordStudies, setWordStudies] = useState([]);
    const [labels, setLabels] = useState([]);
    const [categories, setCategories] = useState({});
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWordStudy, setSelectedWordStudy] = useState(null);
    const [user, setUser] = useState(null);
    const [showSyncBtn, setShowSyncBtn] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Profile settings (stored locally)
    const [profilePic, setProfilePic] = useState(localStorage.getItem('profile_picture') || null);
    const [displayName, setDisplayName] = useState(localStorage.getItem('display_name') || 'My Profile');
    const [editingName, setEditingName] = useState(false);

    // Confirm delete dialog
    const [confirmDelete, setConfirmDelete] = useState({ show: false, type: '', id: null, name: '' });
    const [isDeleting, setIsDeleting] = useState(false);

    // Downloads state
    const [versions, setVersions] = useState([]);
    const [downloadedVersions, setDownloadedVersions] = useState([]);
    const [downloadProgress, setDownloadProgress] = useState({});
    const [storageUsage, setStorageUsage] = useState('0 B');
    const [selectedStudyId, setSelectedStudyId] = useState(null);
    const [expandedCategories, setExpandedCategories] = useState({}); // { label: boolean }
    const [loadedColors, setLoadedColors] = useState(new Set()); // Track which colors have been loaded

    useEffect(() => {
        loadData();
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
                loadData();
                checkUser();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Check for un-migrated local data
        const localId = localStorage.getItem('bible_user_id');
        if (currentUser && localId && localId !== currentUser.id) {
            // Verify if there's actually something to sync
            const needsSync = await checkIfMigrationNeeded(localId);
            if (needsSync) {
                setShowSyncBtn(true);
            } else {
                // If no data, just retire the ID to stop checking
                localStorage.removeItem('bible_user_id');
            }
        }
    };

    const handleManualSync = async () => {
        if (!user) return;
        setSyncing(true);
        try {
            const result = await migrateAnonymousData(user.id);
            if (result.success) {
                const totalMigrated = result.results.reduce((sum, r) => sum + (r.count || 0), 0);
                alert(`Sync Complete! ${totalMigrated} items moved to your account.`);
                setShowSyncBtn(false);
                loadData();
            } else {
                alert('No local data found to sync, or it has already been moved.');
                setShowSyncBtn(false);
            }
        } catch (err) {
            console.error('Manual sync failed:', err);
            alert('Error during sync. Please try again.');
        } finally {
            setSyncing(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        loadData(); // Reload to show anonymous data or empty state
    };

    const loadData = async () => {
        setLoading(true);
        // Optimization: Removed getAllHighlights() from initial load.
        // Highlights are now loaded on-demand when expanding categories.
        const [noteRes, studyRes, wordStudyRes, labelRes, bookRes, categoryRes] = await Promise.all([
            getAllNotes(),
            getStudyCollections(),
            getSavedWordStudies(),
            getLabels(),
            getBooks(),
            getHighlightCategories()
        ]);

        if (noteRes.success) setNotes(noteRes.notes);
        if (studyRes.success) setStudies(studyRes.collections);
        if (wordStudyRes.success) setWordStudies(wordStudyRes.studies);
        if (labelRes.success) setLabels(labelRes.labels);
        if (bookRes.success) setBooks(bookRes.data.all || []);
        if (categoryRes.success) setCategories(categoryRes.categories);

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
        // Use loose equality (==) because bookId might be string from DB but number in books array
        const book = books.find(b => b.id == bookId);
        const name = book?.name_full || bookId;
        return getLocalizedBookName(name, settings.language);
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

    // Calculate unique labels from categories map for rendering the list
    const usedColors = Object.keys(categories);
    const unusedColors = HIGHLIGHT_COLORS.map(c => c.color).filter(c => !usedColors.includes(c));

    let uniqueLabels = [...new Set(Object.values(categories).flatMap(label => String(label).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l)))].sort();

    // Always add 'Other Highlights' if there are colors not assigned to a category
    if (unusedColors.length > 0) {
        uniqueLabels.push('Other Highlights');
    }

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
        } else if (type === 'word study') {
            const result = await removeSavedWordStudy(id);
            success = result.success;
            if (success) setWordStudies(wordStudies.filter(x => x.id !== id));
        } else if (type === 'category') {
            // DEEP DELETE LOGIC
            const label = id;
            setIsDeleting(true);

            try {
                // 1. Identify relevant colors
                let colorsToCheck = [];
                let idsToDelete = []; // [Moved] Scope to top of try block for UI update access
                if (label === 'Other Highlights') {
                    colorsToCheck = unusedColors;
                } else {
                    colorsToCheck = Object.entries(categories)
                        .filter(([_, catLabel]) => {
                            const labels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l);
                            return labels.includes(label);
                        })
                        .map(([color]) => color);
                }

                // 2. Fetch ALL verses for these colors (even if not loaded in UI yet)
                if (colorsToCheck.length > 0) {
                    const res = await getHighlightsByColors(colorsToCheck);
                    if (res.success && res.highlights.length > 0) {
                        let candidates = res.highlights;

                        // 3. Filter candidates to find exact matches for THIS category
                        // If it's a split category, we MUST check text content
                        // We first identify which candidates need text checking
                        const needsTextCheck = candidates.filter(h => {
                            if (h.label) return false; // [NEW] If specific label exists, we trust it; no text check needed

                            if (label === 'Other Highlights') return false;
                            const catLabel = categories[h.color];
                            if (!catLabel) return false;
                            const allLabels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l);
                            return allLabels.length > 1; // Only check text if multiple labels exist
                        });

                        // let idsToDelete = []; // [REMOVED] Used outer scope variable
                        let straightDeleteIds = candidates
                            .filter(h => !needsTextCheck.includes(h))
                            .filter(h => {
                                // [NEW] If explicit label exists, only delete if it matches the target
                                if (h.label) {
                                    // EXCEPTION: If we are deleting 'Other Highlights', we delete EVERYTHING in it, regardless of label/tag.
                                    if (label === 'Other Highlights') return true;

                                    return h.label === label;
                                }
                                return true; // If no label (and not multi-label), assume safe to delete
                            })
                            .map(h => h.id);

                        idsToDelete = [...straightDeleteIds];

                        // 4. For text-check needed items, fetch text and verify
                        if (needsTextCheck.length > 0) {
                            const enriched = await fetchHighlightTexts(needsTextCheck);
                            // Now filter based on text
                            // Now filter based on text
                            const verifiedIds = enriched.filter(e => {
                                const verseText = (e.text || '').toLowerCase();
                                const targetLabel = label.toLowerCase();

                                // 1. Must match the target category to be a candidate
                                if (!verseText.includes(targetLabel)) return false;

                                // 2. PROTECTION CHECK:
                                // If this highlight ALSO belongs to a sibling category (e.g. "Glo"), we must NOT delete it
                                // because the record is shared. 
                                const catLabel = categories[e.color];
                                if (catLabel) {
                                    const allLabels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim().toLowerCase()).filter(l => l);
                                    const siblingLabels = allLabels.filter(l => l !== targetLabel);

                                    const matchesSibling = siblingLabels.some(sibling => verseText.includes(sibling));
                                    if (matchesSibling) {
                                        console.log(`Protected highlight ${e.id} because it also matches sibling label`);
                                        return false; // Don't delete, it's shared!
                                    }
                                }

                                return true; // Matches target and NO siblings -> Safe to delete
                            }).map(e => e.id);

                            idsToDelete = [...idsToDelete, ...verifiedIds];
                        }

                        // 5. Perform Bulk Delete
                        if (idsToDelete.length > 0) {
                            console.log(`🗑️ Deep deleting ${idsToDelete.length} highlights for category: ${label}`);
                            await deleteHighlightsByIds(idsToDelete);
                        }
                    }
                }

                // 6. Finally delete the category label itself (if not 'Other Highlights')
                if (label !== 'Other Highlights') {
                    const result = await deleteCategory(id);
                    success = result.success;
                } else {
                    success = true; // Can't "delete" Other, but we successfully cleared it.
                }

                if (success) {
                    // Update state: remove deleted highlights and re-fetch categories
                    setHighlights(prev => prev.filter(h => {
                        // Immediately remove deleted items from UI to prevent "ghost" jumping
                        if (idsToDelete.includes(h.id)) return false;
                        return true;
                    }));
                    await loadData();
                    setExpandedCategories(prev => ({ ...prev, [label]: false }));
                    setLoadedColors(prev => {
                        // Invalidate cache for these colors so they re-fetch if needed (e.g. if we only deleted partials)
                        // Actually easier to just clear cache for relevant colors
                        const next = new Set(prev);
                        colorsToCheck.forEach(c => next.delete(c));
                        return next;
                    });
                }
            } catch (err) {
                console.error("Deep delete failed", err);
                alert("Failed to delete category contents. Please try again.");
            } finally {
                setIsDeleting(false);
            }
        }

        if (type !== 'category') {
            setConfirmDelete({ show: false, type: '', id: null, name: '' });
        } else {
            // For category, we close it manually after success or if we want to force close
            // But logic above sets show: false implicitly? No.
            // We should just close it here.
            setConfirmDelete({ show: false, type: '', id: null, name: '' });
        }
    };

    const cancelDelete = () => {
        setConfirmDelete({ show: false, type: '', id: null, name: '' });
    };

    const toggleCategory = async (label) => {
        const isNowExpanded = !expandedCategories[label];
        setExpandedCategories(prev => ({
            ...prev,
            [label]: isNowExpanded
        }));

        if (isNowExpanded) {
            let colorsToLoad = [];

            if (label === 'Other Highlights') {
                // Load all colors that are NOT in the categories map
                colorsToLoad = unusedColors.filter(c => !loadedColors.has(c));
            } else {
                // 1. Identify which colors map to this label
                const relevantColors = Object.entries(categories)
                    .filter(([_, catLabel]) => {
                        const labels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l);
                        return labels.includes(label);
                    })
                    .map(([color]) => color);

                // 2. Filter out colors that are ALREADY loaded
                colorsToLoad = relevantColors.filter(c => !loadedColors.has(c));
            }

            if (colorsToLoad.length > 0) {
                const res = await getHighlightsByColors(colorsToLoad);
                if (res.success && res.highlights.length > 0) {
                    let newHighlights = res.highlights;

                    // 3. Check if we need to enrich with text (if label implies splitting)
                    const multiLabelColors = colorsToLoad.filter(c => {
                        const lbl = categories[c];
                        return lbl && String(lbl).match(/[,，、;|/&+]/);
                    });

                    if (multiLabelColors.length > 0) {
                        const highlightsToEnrich = newHighlights.filter(h => multiLabelColors.includes(h.color));
                        if (highlightsToEnrich.length > 0) {
                            import('../services/highlightService').then(async ({ fetchHighlightTexts }) => {
                                const enriched = await fetchHighlightTexts(highlightsToEnrich);
                                setHighlights(prev => {
                                    // Merge enriched data
                                    const enrichedMap = {};
                                    enriched.forEach(e => enrichedMap[e.id] = e.text);

                                    const finalHighlights = newHighlights.map(h => ({
                                        ...h,
                                        text: enrichedMap[h.id] || h.text || ''
                                    }));

                                    // De-dupe
                                    const existingIds = new Set(prev.map(p => p.id));
                                    const uniqueNew = finalHighlights.filter(f => !existingIds.has(f.id));

                                    return [...prev, ...uniqueNew];
                                });
                            });
                            return;
                        }
                    }

                    // If no enrichment needed, just add them
                    setHighlights(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const uniqueNew = newHighlights.filter(f => !existingIds.has(f.id));
                        return [...prev, ...uniqueNew];
                    });

                    // Mark colors as loaded
                    setLoadedColors(prev => {
                        const next = new Set(prev);
                        colorsToLoad.forEach(c => next.add(c));
                        return next;
                    });
                } else {
                    // Even if empty, mark as loaded to avoid re-fetch
                    setLoadedColors(prev => {
                        const next = new Set(prev);
                        colorsToLoad.forEach(c => next.add(c));
                        return next;
                    });
                }
            }
        }
    };

    const tabs = [
        { id: 'highlights', label: '📌 Highlights', count: Object.keys(categories).length },
        { id: 'notes', label: '📝 Notes', count: notes.length },
        { id: 'studies', label: '📚 Studies', count: studies.length },
        { id: 'wordStudies', label: '📜 Word Studies', count: wordStudies.length },
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

                <div className="settings-row">
                    <div className="language-selector">
                        <span className="lang-label">{settings.language === 'af' ? 'Vir Jou Inhoud in Afr / Eng' : 'For You Content in Afr / Eng'}</span>
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

                    <div className="theme-selector">
                        <span className="lang-label">{settings.language === 'af' ? 'Tema Modus' : 'Theme Mode'}</span>
                        <div className="lang-toggle-container">
                            <button
                                className={`lang-btn ${settings.themeMode === 'dark' ? 'active' : ''}`}
                                onClick={() => updateSettings({ themeMode: 'dark' })}
                            >
                                {settings.language === 'af' ? 'Donker' : 'Dark'}
                            </button>
                            <button
                                className={`lang-btn ${settings.themeMode === 'light' ? 'active' : ''}`}
                                onClick={() => updateSettings({ themeMode: 'light' })}
                            >
                                {settings.language === 'af' ? 'Lig' : 'Light'}
                            </button>
                        </div>
                    </div>


                </div>


                <div className="auth-status-container">
                    {user ? (
                        <div className="logged-in-info">
                            <span className="user-email">✉️ {user.email}</span>
                            <div className="auth-actions">
                                <button className="logout-btn" onClick={handleLogout}>Logout</button>
                                {showSyncBtn && (
                                    <button
                                        className="sync-btn"
                                        onClick={handleManualSync}
                                        disabled={syncing}
                                    >
                                        {syncing ? '⌛ Syncing...' : '🔄 Sync Local Data'}
                                    </button>
                                )}
                            </div>
                            {showSyncBtn && (
                                <p className="sync-tip">
                                    Found un-synced notes on this browser. Click "Sync" to move them to your account.
                                </p>
                            )}
                        </div>
                    ) : (
                        <button className="login-btn-link" onClick={() => navigate('/auth')}>
                            🔐 Login / Sign Up to sync across devices
                        </button>
                    )}
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
                            <div className="highlights-grouped-container">
                                {uniqueLabels.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No highlights yet</p>
                                        <p className="empty-hint">Tap on a verse while reading to add highlights</p>
                                    </div>
                                ) : (
                                    // Render Category Headers directly (On-Demand Mode)
                                    uniqueLabels.map(label => {
                                        const isExpanded = expandedCategories[label];

                                        // Filter highlights for this label from the loaded 'highlights' array
                                        const group = highlights.filter(h => {
                                            const catLabel = categories[h.color];

                                            // Handle Other Highlights
                                            if (label === 'Other Highlights') {
                                                if (!catLabel) return true; // It's uncategorized/unused color
                                                // Check unused colors logic
                                                return false;
                                            }

                                            if (!catLabel) return false;

                                            // Check text splitting logic
                                            const allLabels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l);
                                            if (!allLabels.includes(label)) return false;

                                            if (allLabels.length > 1) {
                                                // [NEW] Use explicit label if available
                                                if (h.label) {
                                                    return h.label === label;
                                                }

                                                const verseText = (h.text || '').toLowerCase();
                                                const match = verseText.includes(label.toLowerCase());
                                                // Fallback if no match: show in all
                                                if (!match) {
                                                    const anyMatch = allLabels.some(l => verseText.includes(l.toLowerCase()));
                                                    if (!anyMatch) return true; // Show in all if no match found
                                                    return false; // Matched another label, not this one
                                                }
                                                return true;
                                            }
                                            return true;
                                        });

                                        // Calculate if we are still loading data for this category
                                        const categoryColors = label === 'Other Highlights'
                                            ? unusedColors
                                            : Object.keys(categories).filter(c => {
                                                const l = categories[c];
                                                return String(l).split(/[,，、;|/&+]/).map(s => s.trim()).includes(label);
                                            });

                                        const isFullyLoaded = categoryColors.every(c => loadedColors.has(c));

                                        return (
                                            <div key={label} className={`highlight-category-group ${isExpanded ? 'is-expanded' : ''}`}>
                                                <div className="category-header-wrapper">
                                                    <button
                                                        className="category-header"
                                                        onClick={() => toggleCategory(label)}
                                                        aria-expanded={isExpanded}
                                                    >
                                                        <span className="category-title">{label}</span>
                                                        <span className="category-count">
                                                            {/* If loaded, show count. If not, show '?' or just '...' */}
                                                            {isExpanded ? `(${group.length})` : '(Click to Load)'}
                                                        </span>
                                                        <span className="category-chevron">{isExpanded ? '▼' : '▶'}</span>
                                                    </button>

                                                    <button
                                                        className="delete-category-btn"
                                                        onClick={(e) => openDeleteConfirm('category', label, label, e)}
                                                        title={settings.language === 'af' ? 'Vee kategorie uit' : 'Delete category'}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>

                                                {isExpanded && (
                                                    <div className="highlights-list">
                                                        {group.length === 0 ? (
                                                            !isFullyLoaded ? (
                                                                <div style={{ padding: '10px', color: '#888', fontStyle: 'italic' }}>Loading verses...</div>
                                                            ) : (
                                                                <div style={{ padding: '10px', color: '#888', fontStyle: 'italic' }}>No verses found</div>
                                                            )
                                                        ) : (
                                                            group.map(h => (
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
                                                                        onClick={(e) => openDeleteConfirm('highlight', h.id, `${getBookName(h.book_id)} ${h.chapter}:{h.verse}`, e)}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
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

                        {/* Word Studies Tab */}
                        {activeTab === 'wordStudies' && (
                            <div className="word-studies-list">
                                {wordStudies.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No word studies yet</p>
                                        <p className="empty-hint">Use "Word Study" while reading and tap the ★ icon to save</p>
                                    </div>
                                ) : (
                                    wordStudies.map(ws => (
                                        <div
                                            key={ws.id}
                                            className="word-study-item"
                                            onClick={() => setSelectedWordStudy(ws)}
                                        >
                                            <div className="ws-item-header">
                                                <div className="ws-item-word">
                                                    <span className="ws-translation-word">{ws.word}</span>
                                                    <span className="ws-lemma-word">({ws.lemma})</span>
                                                </div>
                                                <div className="ws-item-ref">{ws.verse_ref}</div>
                                            </div>
                                            <div className="ws-item-summary">
                                                {ws.analysis.word?.transliteration} • {ws.analysis.word?.contextualMeaning?.substring(0, 60)}...
                                            </div>
                                            <button
                                                className="delete-btn"
                                                onClick={(e) => openDeleteConfirm('word study', ws.id, `${ws.word} (${ws.verse_ref})`, e)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Downloads Tab */}
                        {activeTab === 'downloads' && (
                            <div className="downloads-list">
                                <div className="debug-section" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#3f1a1a', borderRadius: '8px', border: '1px solid #ef4444' }}>
                                    <h3 style={{ color: '#ef4444', marginTop: 0 }}>Troubleshooting</h3>
                                    <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                                        If you are seeing old data or weird characters (like "Â k"), tap this button to reset the app cache completely.
                                    </p>
                                    <button
                                        className="reset-app-btn"
                                        style={{
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            padding: '10px 20px',
                                            borderRadius: '6px',
                                            marginTop: '10px',
                                            cursor: 'pointer',
                                            width: '100%',
                                            fontWeight: 'bold'
                                        }}
                                        onClick={async () => {
                                            if (window.confirm("This will clear all offline data and refresh the app. Continue?")) {
                                                // 1. Unregister Service Workers
                                                if ('serviceWorker' in navigator) {
                                                    const registrations = await navigator.serviceWorker.getRegistrations();
                                                    for (let registration of registrations) {
                                                        await registration.unregister();
                                                    }
                                                }
                                                // 2. Clear Cache Storage
                                                if ('caches' in window) {
                                                    const keys = await caches.keys();
                                                    for (let key of keys) {
                                                        await caches.delete(key);
                                                    }
                                                }
                                                // 3. Clear Local Storage (Optional, but safe for verse data)
                                                // We preserve 'user_settings' if needed, but for 'corrupt verse data' total wipe is safer.
                                                // localStorage.clear(); 
                                                // Let's NOT clear localStorage entirely to keep highlights/notes unless user wants to.
                                                // Just reload.
                                                window.location.reload(true);
                                            }
                                        }}
                                    >
                                        ⚠️ Hard Reset App Data
                                    </button>
                                </div>

                                <div className="storage-info" style={{ marginTop: '20px' }}>
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
                                                {isDownloading && (
                                                    <div className="progress-bar-container">
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="download-actions">
                                                {downloaded ? (
                                                    <button
                                                        className="delete-dl-btn"
                                                        onClick={() => handleDeleteDownload(version.id)}
                                                    >
                                                        🗑️
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="download-btn"
                                                        onClick={() => handleDownload(version.id)}
                                                        disabled={isDownloading}
                                                    >
                                                        {isDownloading ? `${Math.round(progress)}%` : '⬇️'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {selectedWordStudy && (
                <WordStudyModal
                    wordData={selectedWordStudy.analysis}
                    onClose={() => setSelectedWordStudy(null)}
                />
            )}

            {/* Confirm Delete Modal */}
            {confirmDelete.show && (
                <div className="confirm-modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete {confirmDelete.name}?</p>
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

export default Profile;
