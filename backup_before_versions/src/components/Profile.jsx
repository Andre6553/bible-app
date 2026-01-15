/**
 * Profile Page - User's highlights, notes, studies, and profile picture
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllNotes, getStudyCollections, createStudyCollection, getLabels, removeHighlight, deleteNote, deleteStudyCollection, HIGHLIGHT_COLORS, getHighlightCategories, deleteCategory, getHighlightsByColors, deleteHighlightsByIds, fetchHighlightTexts, getHighlightCount } from '../services/highlightService';
import { getBooks, getVersions, logActivity } from '../services/bibleService';
import { getLocalizedBookName } from '../constants/bookNames';
import { isVersionDownloaded, getDownloadedVersions, downloadVersion, deleteOfflineVersion, getStorageUsage, formatBytes } from '../services/offlineService';
import { getSavedWordStudies, deleteWordStudy as removeSavedWordStudy } from '../services/wordStudyService';
import WordStudyModal from './WordStudyModal';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../config/supabaseClient';
import { migrateAnonymousData, checkIfMigrationNeeded } from '../services/migrationService';
import TutorialOverlay from './TutorialOverlay';
import './Profile.css';

function Profile() {
    const navigate = useNavigate();
    const { settings, updateSettings, profile, fetchProfile, user, manualSetUser } = useSettings();
    const [activeTab, setActiveTab] = useState('highlights');
    const [highlights, setHighlights] = useState([]);
    const [totalHighlightCount, setTotalHighlightCount] = useState(0);
    const [notes, setNotes] = useState([]);
    const [studies, setStudies] = useState([]);
    const [wordStudies, setWordStudies] = useState([]);
    const [labels, setLabels] = useState([]);
    const [categories, setCategories] = useState({});
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWordStudy, setSelectedWordStudy] = useState(null);
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
    const [loadingSpecificCategory, setLoadingSpecificCategory] = useState({}); // { label: boolean } used for RPC loading items like "Other Highlights"
    const [isPwaReady, setIsPwaReady] = useState(false);
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [tutorialStepIdx, setTutorialStepIdx] = useState(0);

    const tutorialSteps = [
        {
            target: '.profile-tabs',
            title: settings.language === 'af' ? 'Jou Biblioteek' : 'Your Library',
            content: settings.language === 'af'
                ? 'Hier vind jy al jou persoonlike inhoud, van merke tot notas en studies.'
                : 'Here you\'ll find all your personal content, from highlights to notes and studies.'
        },
        {
            target: '#tutorial-highlight-discovery',
            title: settings.language === 'af' ? 'Gestoorde Merke' : 'Stored Highlights',
            content: settings.language === 'af'
                ? 'Al jou gekleurde verse is hier gegroepeer. Jy kan op n kategorie klik om dit oop te maak.'
                : 'All your colored verses are grouped here. You can click on a category to open it.'
        },
        {
            target: '.profile-tab[id="notes"]',
            title: settings.language === 'af' ? 'Notas & Studies' : 'Notes & Studies',
            content: settings.language === 'af'
                ? 'Wissel tussen bachoeke om jou ander gestoorde items te bekyk.'
                : 'Switch between tabs to view your other saved items.'
        }
    ];

    useEffect(() => {
        loadData();
        checkUser();
        checkPwaStatus();

        // Check if we should show tutorial (navigated from search)
        const showTutorial = localStorage.getItem('profile_tutorial_trigger');
        if (showTutorial === 'true') {
            setIsTutorialOpen(true);
            localStorage.removeItem('profile_tutorial_trigger');
        }
    }, [user]);

    const checkUser = async () => {
        const currentUser = user;

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

    const checkPwaStatus = async () => {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            setIsPwaReady(regs.length > 0);
        }
    };

    const handleManualSync = async () => {
        if (!user) return;
        setSyncing(true);
        try {
            const localId = localStorage.getItem('bible_user_id');
            const result = await migrateAnonymousData(user.id);
            if (result.success) {
                alert('Success! Your highlights and notes have been synced to your account.');
                localStorage.removeItem('bible_user_id');
                setShowSyncBtn(false);
                loadData(); // Refresh everything
            } else {
                alert('Migration failed: ' + result.error);
            }
        } catch (err) {
            console.error('Sync error:', err);
            alert('An unexpected error occurred during sync.');
        } finally {
            setSyncing(false);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Force clean state regardless of server response
            if (manualSetUser) manualSetUser(null); // CRITICAL FIX: Force global state clear
            setHighlights([]);
            setNotes([]);
            setStudies([]);
            setWordStudies([]);
            localStorage.removeItem('bible_user_id'); // Clear guest ID if any
            loadData(); // Reload to show anonymous data or empty state
        }
    };

    const loadData = async () => {
        setLoading(true);
        const targetUserId = user?.id || null;
        console.log(`[Profile] 🛰️ Target User ID: ${targetUserId || 'Guest'}`);

        const fetchWithLog = async (name, promise) => {
            console.log(`[Profile] ⏳ Fetching ${name}...`);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} TIMEOUT`)), 10000));
            try {
                const result = await Promise.race([promise, timeoutPromise]);
                console.log(`[Profile] 🏁 ${name} fetched:`, result.success ? 'Success' : 'Failed');
                return result;
            } catch (err) {
                console.error(`[Profile] ❌ ${name} failed/timed out:`, err.message);
                return { success: false, error: err.message };
            }
        };

        try {
            // Reordered: Simpler queries first to isolate RLS issues
            const countRes = await fetchWithLog('HighlightCount', getHighlightCount(targetUserId));
            if (countRes.success) setTotalHighlightCount(countRes.count);

            const categoryRes = await fetchWithLog('Categories', getHighlightCategories(targetUserId));
            if (categoryRes.success) setCategories(categoryRes.categories);

            const noteRes = await fetchWithLog('Notes', getAllNotes(targetUserId));
            if (noteRes.success) setNotes(noteRes.notes);

            const studyRes = await fetchWithLog('Collections', getStudyCollections(targetUserId));
            if (studyRes.success) setStudies(studyRes.collections);

            const wordStudyRes = await fetchWithLog('WordStudies', getSavedWordStudies(targetUserId));
            if (wordStudyRes.success) setWordStudies(wordStudyRes.studies);

            const labelRes = await fetchWithLog('Labels', getLabels(targetUserId));
            if (labelRes.success) setLabels(labelRes.labels);

            const bookRes = await fetchWithLog('Books', getBooks());
            if (bookRes.success) setBooks(bookRes.data.all || []);

        } catch (err) {
            console.error('[Profile] ❌ Critical error in loadData:', err);
        } finally {
            setLoading(false);
            console.log('[Profile] 🏁 loadData finished');

            // Background load extra info
            getVersions().then(res => res.success && setVersions(res.data));
            getDownloadedVersions().then(res => setDownloadedVersions(res));
            getStorageUsage().then(res => setStorageUsage(res.formatted));
        }
    };

    // DIAGNOSTIC STATE
    const [diagResults, setDiagResults] = useState({});
    const [runningDiag, setRunningDiag] = useState(false);

    const runDiagnostics = async () => {
        setRunningDiag(true);
        const results = {};

        // 1. PUBLIC INTERNET
        try {
            const start = Date.now();
            await fetch('https://api.ipify.org?format=json');
            results.internet = `✅ Online (${Date.now() - start}ms)`;
        } catch (e) {
            results.internet = `❌ Failed: ${e.message}`;
        }

        // 2. SUPABASE PUBLIC
        try {
            const start = Date.now();
            const { error } = await supabase.from('app_settings').select('count').limit(1).single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is fine (no rows)
            results.supabasePublic = `✅ Connected (${Date.now() - start}ms)`;
        } catch (e) {
            results.supabasePublic = `❌ Failed: ${e.message}`;
        }

        // 3. AUTH CHECK
        try {
            const start = Date.now();
            const { data: { session } } = await supabase.auth.getSession();
            results.auth = session ? `✅ Authenticated (${Date.now() - start}ms)` : '❌ No Session';
        } catch (e) {
            results.auth = `❌ Error: ${e.message}`;
        }

        // 4. PRIVATE DATA (RLS)
        try {
            const start = Date.now();
            // Try simpler query first: Highlight Count
            const { count, error } = await supabase.from('verse_highlights').select('*', { count: 'exact', head: true });
            if (error) throw error;
            results.rls = `✅ Read Access (${Date.now() - start}ms)`;
        } catch (e) {
            results.rls = `❌ Blocked: ${e.message}`;
        }

        setDiagResults(results);
        setRunningDiag(false);
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

    // Calculate unique labels and identify unused colors
    const usedColors = new Set();
    Object.keys(categories).forEach(c => usedColors.add(c));

    // Fix: We need unusedColors for the 'Other Highlights' toggle logic. 
    // We can base it on HIGHLIGHT_COLORS for now, or better yet, we should just allow ANY color 
    // when 'Other Highlights' is clicked, but the logic in toggleCategory relies on this array.
    const unusedColors = HIGHLIGHT_COLORS.map(c => c.color).filter(c => !usedColors.has(c));

    let uniqueLabels = [...new Set(Object.values(categories).flatMap(label => String(label).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l)))].sort();

    // [CRITICAL FIX] Ensure "Other Highlights" is ALWAYS added.
    // We remove the count check to debug visibility.
    if (!uniqueLabels.includes('Other Highlights')) {
        uniqueLabels.push('Other Highlights');
    }

    uniqueLabels = [...new Set(uniqueLabels)]; // Dedupe again just in case

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
                                    // EXCEPTION 1: If we are deleting 'Other Highlights', we delete EVERYTHING in it, regardless of label/tag.
                                    if (label === 'Other Highlights') return true;

                                    // EXCEPTION 2: If this category is "Simple" (exclusive color), we force delete everything of this color.
                                    // Because the Display logic shows them regardless of label mismatch if it's an exclusive color.
                                    const catLabel = categories[h.color];
                                    if (catLabel) {
                                        const allLabels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l);
                                        // If it's a simple 1:1 mapping, this color belongs 100% to this category.
                                        // So we delete it, even if h.label says something else (e.g. from search text).
                                        if (allLabels.length === 1) return true;
                                    }

                                    return h.label === label;
                                }
                                // [CRITICAL FIX] If no explicit label, it means the highlight belongs to the category via color.
                                // It should be safe to delete because we already filtered by color in step 1 & 2.
                                // And 'needsTextCheck' handles multi-label colors (e.g. split categories).
                                return true;
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
                setLoadingSpecificCategory(prev => ({ ...prev, [label]: true }));

                // [OPTIMIZED FIX] Use dedicated RPC to fetch only orphans
                const { getOrphanedHighlights } = await import('../services/highlightService');
                const res = await getOrphanedHighlights();

                if (res.success) {
                    setHighlights(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const uniqueNew = res.highlights.filter(h => !existingIds.has(h.id));
                        return [...prev, ...uniqueNew];
                    });
                }
                setLoadingSpecificCategory(prev => ({ ...prev, [label]: false }));
                colorsToLoad = []; // Skip standard loader
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
        { id: 'highlights', label: 'Highlights', icon: '🖍️', count: totalHighlightCount },
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

                {/* Subscription Badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '20px',
                    margin: '8px 0',
                    fontSize: '0.9rem',
                    border: '1px solid var(--border-color)'
                }}>
                    {(() => {
                        const isPremium = profile?.subscription_override === 'premium' ||
                            profile?.subscription_override === 'admin' ||
                            profile?.subscription_override === 'tester' ||
                            (profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date());

                        return isPremium ? (
                            <>
                                <span style={{ fontSize: '1.2rem' }}>⭐</span>
                                <span style={{ color: '#FFD700', fontWeight: 'bold' }}>
                                    {settings.language === 'af' ? 'Premium Intekenaar' : 'Premium Subscriber'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span style={{ fontSize: '1.2rem', filter: 'grayscale(1)' }}>⭐</span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {settings.language === 'af' ? 'Gewone Gebruiker' : 'Regular User'}
                                </span>
                            </>
                        );
                    })()}
                </div>

                <div className="offline-status-badge">
                    {isPwaReady ? (
                        <div className="status-item ready" title="App is cached and ready for offline use">
                            <span>🛡️ App Offline-Ready</span>
                            <span className="dot"></span>
                        </div>
                    ) : (
                        <div className="status-item waiting" title="App is still preparing for offline use...">
                            <span>⌛ Preparing Offline Mode...</span>
                        </div>
                    )}
                    {downloadedVersions.length > 0 && (
                        <div className="status-item ready" title={`${downloadedVersions.length} Bible(s) downloaded`}>
                            <span>📖 {downloadedVersions.length} Bibles Offline</span>
                        </div>
                    )}
                </div>

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
                        id={`tutorial-tab-${tab.id}`}
                        className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id !== 'notes') setSelectedStudyId(null); // Clear filter when leaving notes context (optional, but good UX)
                        }}
                    >
                        {tab.label} <span className="tab-count">{tab.count}</span>
                    </button>
                ))}

                {/* Sermon Prep Button */}
                <button
                    className="profile-tab sermon-prep-btn"
                    onClick={() => navigate('/sermon-prep')}
                >
                    ⛪ {settings.language === 'af' ? 'Preek Voorbereiding' : 'Sermon Preparation'}
                </button>
            </div>

            {/* Content */}
            <div className="profile-content">
                {loading ? (
                    <div className="loading-state">Loading...</div>
                ) : (
                    <>
                        {/* Highlights Tab */}
                        {activeTab === 'highlights' && (
                            <div className="highlights-list-container">
                                {uniqueLabels.length === 0 ? (
                                    <div className="premium-empty-state">
                                        <div className="empty-state-icon">🖍️</div>
                                        <h3>No highlights yet</h3>
                                        <p>As you read the Bible, long-press or tap a verse to highlight your favorite passages.</p>
                                        <button className="cta-btn" onClick={() => navigate('/bible')}>
                                            Start Reading
                                        </button>
                                    </div>
                                ) : (
                                    <div className="highlights-grouped-container" id="tutorial-highlight-discovery">
                                        {uniqueLabels.map(label => {
                                            const isExpanded = expandedCategories[label];
                                            const group = highlights.filter(h => {
                                                const catLabel = categories[h.color];
                                                if (label === 'Other Highlights') {
                                                    if (!categories[h.color]) return true;
                                                    return false;
                                                }
                                                if (!catLabel) return false;
                                                const allLabels = String(catLabel).split(/[,，、;|/&+]/).map(l => l.trim()).filter(l => l);
                                                if (!allLabels.includes(label)) return false;
                                                if (allLabels.length > 1 && h.label) {
                                                    return h.label === label;
                                                }
                                                return true;
                                            });

                                            const categoryColors = label === 'Other Highlights' ? [] : Object.keys(categories).filter(c => {
                                                return String(categories[c]).split(/[,，、;|/&+]/).map(s => s.trim()).includes(label);
                                            });
                                            const isFullyLoaded = label === 'Other Highlights' ? !loadingSpecificCategory[label] : categoryColors.every(c => loadedColors.has(c));

                                            return (
                                                <div key={label} className={`highlight-category-group ${isExpanded ? 'is-expanded' : ''}`}>
                                                    <div className="category-header-wrapper">
                                                        <button className="category-header" onClick={() => toggleCategory(label)}>
                                                            <span className="category-title">{label}</span>
                                                            <span className="category-count">{isExpanded ? `(${group.length})` : '(Click to Load)'}</span>
                                                            <span className="category-chevron">{isExpanded ? '▼' : '▶'}</span>
                                                        </button>
                                                        <button className="delete-category-btn" onClick={(e) => openDeleteConfirm('category', label, label, e)}>🗑️</button>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="highlights-list">
                                                            {group.length === 0 ? (
                                                                <div style={{ padding: '10px', color: '#888', fontStyle: 'italic' }}>{isFullyLoaded ? 'No verses found' : 'Loading verses...'}</div>
                                                            ) : (
                                                                group.map(h => (
                                                                    <div key={h.id} className="highlight-item" onClick={() => navigateToVerse(h.book_id, h.chapter, h.verse)}>
                                                                        <div className="highlight-color-dot" style={{ backgroundColor: h.color }} />
                                                                        <div className="highlight-info">
                                                                            <span className="highlight-ref">{getBookName(h.book_id)} {h.chapter}:{h.verse}</span>
                                                                            <span className="highlight-version">{h.version}</span>
                                                                        </div>
                                                                        <button className="delete-btn" onClick={(e) => openDeleteConfirm('highlight', h.id, `${getBookName(h.book_id)} ${h.chapter}:{h.verse}`, e)}>🗑️</button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div style={{ height: '300px', width: '100%', flexShrink: 0 }}></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes Tab */}
                        {activeTab === 'notes' && (
                            <div className="notes-list-container">
                                {notes.length === 0 ? (
                                    <div className="premium-empty-state">
                                        <div className="empty-state-icon">📝</div>
                                        <h3>Your thoughts, preserved</h3>
                                        <p>Capture your reflections, prayers, and insights as you study the Word.</p>
                                        <button className="cta-btn" onClick={() => navigate('/bible')}>
                                            Go to Bible
                                        </button>
                                    </div>
                                ) : (
                                    <div className="notes-list">
                                        {selectedStudyId && (
                                            <div className="filter-banner">
                                                <span>Filtering by study: <strong>{studies.find(s => s.id === selectedStudyId)?.name}</strong></span>
                                                <button onClick={() => setSelectedStudyId(null)}>Clear Filter</button>
                                            </div>
                                        )}
                                        {(selectedStudyId ? notes.filter(n => n.study_id === selectedStudyId) : notes).map(note => (
                                            <div key={note.id} className="note-item" onClick={() => navigate(`/bible?book=${note.book_id}&chapter=${note.chapter}`)}>
                                                <div className="note-ref">{getBookName(note.book_id)} {note.chapter}:{note.verse}</div>
                                                <p className="note-text-preview">{note.note_text}</p>
                                                <div className="note-footer">
                                                    {note.study_collections && (
                                                        <span className="note-study-badge" style={{ backgroundColor: note.study_collections.color }}>{note.study_collections.name}</span>
                                                    )}
                                                    <button className="delete-btn" onClick={(e) => openDeleteConfirm('note', note.id, `${getBookName(note.book_id)} ${note.chapter}:${note.verse}`, e)}>🗑️</button>
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ height: '300px', width: '100%', flexShrink: 0 }}></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Studies Tab */}
                        {activeTab === 'studies' && (
                            <div className="studies-list">
                                <div style={{ padding: '0 var(--spacing-md) var(--spacing-md)' }}>
                                    <button
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            backgroundColor: 'var(--accent-color)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                        onClick={async () => {
                                            const name = prompt(settings.language === 'af' ? "Gee 'n naam vir jou nuwe studie:" : "Enter a name for your new study collection:");
                                            if (name && name.trim()) {
                                                const res = await createStudyCollection(name.trim());
                                                if (res.success) {
                                                    setStudies([res.collection, ...studies]);
                                                } else {
                                                    alert("Failed to create study");
                                                }
                                            }
                                        }}
                                    >
                                        <span>➕</span> {settings.language === 'af' ? 'Skep Nuwe Studie' : 'Create New Study'}
                                    </button>
                                </div>

                                {studies.length === 0 ? (
                                    <div className="empty-state">
                                        <p>{settings.language === 'af' ? 'Nog geen studies nie' : 'No study collections yet'}</p>
                                        <p className="empty-hint">
                                            {settings.language === 'af'
                                                ? 'Skep \'n studie om verwante notas en skrifgedeeltes saam te groepeer'
                                                : 'Create a study to group related notes and scriptures together'}
                                        </p>
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
                                {/* Physical Spacer to force scroll */}
                                <div style={{ height: '300px', width: '100%', flexShrink: 0 }}></div>
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
                                {/* Physical Spacer to force scroll */}
                                <div style={{ height: '300px', width: '100%', flexShrink: 0 }}></div>
                            </div>
                        )}

                        {/* Downloads Tab */}
                        {activeTab === 'downloads' && (
                            <div className="premium-downloads-container">

                                <div className="storage-dashboard">
                                    <div className="storage-stats">
                                        <div className="storage-left">
                                            <span className="storage-label">Local Storage</span>
                                            <span className="storage-value">{storageUsage}</span>
                                        </div>
                                        <span className="storage-feature-badge">✨ Sync Enabled</span>
                                    </div>
                                    <div className="storage-pills">
                                        {/* Visual bar placeholder - CSS will handle the fill */}
                                        <div className="storage-bar">
                                            <div className="storage-fill" style={{ width: '35%' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const groups = {
                                        English: [],
                                        Afrikaans: [],
                                        Xhosa: []
                                    };

                                    versions.forEach(v => {
                                        const lang = v.language?.toLowerCase() || '';
                                        if (lang.startsWith('af')) groups.Afrikaans.push(v);
                                        else if (lang.startsWith('xh')) groups.Xhosa.push(v);
                                        else groups.English.push(v);
                                    });

                                    return Object.entries(groups).map(([lang, groupVersions]) => {
                                        if (groupVersions.length === 0) return null;

                                        return (
                                            <div key={lang} className="download-language-group">
                                                <h3 className="download-group-header">
                                                    {lang === 'English' ? 'English - english versions' :
                                                        lang === 'Afrikaans' ? 'Afrikaans - afrikaans versions' :
                                                            lang}
                                                </h3>
                                                <div className="download-group-list">
                                                    {groupVersions.map(version => {
                                                        const downloaded = isDownloaded(version.id);
                                                        const info = getDownloadInfo(version.id);
                                                        const progress = downloadProgress[version.id];
                                                        const isDownloading = progress !== undefined;

                                                        return (
                                                            <div key={version.id} className={`premium-download-card ${downloaded ? 'downloaded' : ''} ${isDownloading ? 'syncing' : ''}`}>
                                                                <div className="card-main-info">
                                                                    <div className="card-header-row">
                                                                        <span className="version-name">{version.name}</span>
                                                                        {downloaded && <span className="premium-badge">Offline Ready</span>}
                                                                    </div>
                                                                    <div className="card-meta">
                                                                        <span className="version-abbrev">{version.abbreviation}</span>
                                                                        {downloaded && info && (
                                                                            <span className="version-size"> • {formatBytes(info.size_bytes)}</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="card-status-actions">
                                                                    {isDownloading ? (
                                                                        <div className="card-sync-status">
                                                                            <div className="sync-spinner"></div>
                                                                            <span className="sync-text">
                                                                                {progress >= 90 && progress < 100 ? 'Verifying...' : `${Math.round(progress)}%`}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="card-controls">
                                                                            {downloaded ? (
                                                                                <button
                                                                                    className="card-action-btn delete"
                                                                                    onClick={() => handleDeleteDownload(version.id)}
                                                                                    title="Delete Offline Data"
                                                                                >
                                                                                    🗑️
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    className="card-action-btn download"
                                                                                    onClick={() => handleDownload(version.id)}
                                                                                    title="Download for Offline"
                                                                                >
                                                                                    ⬇️
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {isDownloading && (
                                                                    <div className="card-progress-bar">
                                                                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {
                selectedWordStudy && (
                    <WordStudyModal
                        verse={{
                            book_id: selectedWordStudy.book_id,
                            chapter: selectedWordStudy.chapter,
                            verse: selectedWordStudy.verse
                        }}
                        verseRef={selectedWordStudy.verse_ref}
                        initialSelectedWord={selectedWordStudy.word}
                        initialStudyData={selectedWordStudy.analysis}
                        onClose={() => setSelectedWordStudy(null)}
                    />
                )
            }

            <footer className="profile-legal-footer" style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.6, fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' }}>
                    <a href="/privacy" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Privacy Policy</a>
                    <a href="/terms" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Terms of Service</a>
                </div>
                <p>© {new Date().getFullYear()} Omni Bible (Pty) Ltd. POPIA Compliant.</p>
            </footer>

            {/* Confirm Delete Modal */}
            {
                confirmDelete.show && (
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
                )
            }

            <TutorialOverlay
                isOpen={isTutorialOpen}
                steps={tutorialSteps}
                language={settings.language}
                onComplete={() => {
                    setIsTutorialOpen(false);
                    setTutorialStepIdx(0);
                }}
            />
        </div >
    );
}

export default Profile;
