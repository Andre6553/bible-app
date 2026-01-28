import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ShareImageModal from './ShareImageModal';
import WordStudyModal from './WordStudyModal';
import {
    getChapter,
    getVersions,
    getBooks,
    getUserId,
    getOriginalVerse,
    getChapterCount,
    getVerseCount,
    logActivity,
    logBibleReading,
    getLastReadState
} from '../services/bibleService';
import {
    getChapterHighlights,
    saveHighlight,
    removeHighlight,
    getVerseNote,
    saveNote,
    HIGHLIGHT_COLORS,
    getHighlightCategories,
    saveHighlightCategory
} from '../services/highlightService';
import { getLocalizedBookName } from '../constants/bookNames';
import { useSettings } from '../context/SettingsContext';
import VerseActionSheet from './VerseActionSheet';
import NoteModal from './NoteModal';
import BibleHelpModal from './BibleHelpModal';
import OmniDefinitionModal from './OmniDefinitionModal';
import ChapterSummaryModal from './ChapterSummaryModal';
import './BibleReader.css';
import { resetAppCache } from '../utils/appUtils';

const THEME_COLORS = [
    '#6366f1', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
    '#78716c', '#d97706'
];

const hexToRgba = (hex, alpha) => {
    if (!hex) return 'transparent';
    if (hex.startsWith('rgb')) return hex; // Already rgb/rgba
    let r = 0, g = 0, b = 0;
    // Handle short hex like #fff
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function BibleReader({ currentVersion, setCurrentVersion, versions }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [books, setBooks] = useState({ oldTestament: [], newTestament: [] });
    const [selectedBook, setSelectedBook] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(1);
    const [chapterCount, setChapterCount] = useState(1);
    const [verseCount, setVerseCount] = useState(0); // For verse selection grid
    const [verses, setVerses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showBookSelector, setShowBookSelector] = useState(false);

    // Settings Scope
    const { settings, updateSettings } = useSettings();
    const [showSettings, setShowSettings] = useState(false);

    // Navigation State
    const [selectionStage, setSelectionStage] = useState('books'); // 'books', 'chapters', 'verses'
    const [tempSelectedBook, setTempSelectedBook] = useState(null);
    const [tempSelectedChapter, setTempSelectedChapter] = useState(1);
    const [targetVerse, setTargetVerse] = useState(null); // For scrolling to verse
    const [showInfo, setShowInfo] = useState(false); // Info Modal state
    const [showDefinition, setShowDefinition] = useState(false); // Omni Definition Modal state

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, text: '', step: 'initial' });

    // Highlight State
    const [highlights, setHighlights] = useState({}); // { verseNum: color }
    const [categories, setCategories] = useState({}); // { colorHex: label }
    const [selectedVerses, setSelectedVerses] = useState([]); // Array of verse objects
    const [showActionSheet, setShowActionSheet] = useState(false);

    const [syncPrompt, setSyncPrompt] = useState(null); // { bookId, chapter, title }
    const [isReaderMode, setIsReaderMode] = useState(false);
    const [showReaderControls, setShowReaderControls] = useState(true);
    const [isFirstSyncDone, setIsFirstSyncDone] = useState(false); // Robust cloud-check protection
    const [isScrolled, setIsScrolled] = useState(false);
    const [currentScrollVerse, setCurrentScrollVerse] = useState(1); // Track top visible verse

    // Manage body classes for UI visibility
    useEffect(() => {
        if (showActionSheet && selectedVerses.length > 0) {
            document.body.classList.add('action-sheet-open');
        } else {
            document.body.classList.remove('action-sheet-open');
        }

        if (isReaderMode) {
            document.body.classList.add('reader-mode-active');
        } else {
            document.body.classList.remove('reader-mode-active');
        }

        return () => {
            document.body.classList.remove('action-sheet-open');
            document.body.classList.remove('reader-mode-active');
        };
    }, [showActionSheet, selectedVerses, isReaderMode]);

    // Auto-hide Reader Mode controls after 4 seconds
    useEffect(() => {
        let timer;
        if (isReaderMode && showReaderControls) {
            timer = setTimeout(() => {
                setShowReaderControls(false);
            }, 4000);
        }
        return () => clearTimeout(timer);
    }, [isReaderMode, showReaderControls]);

    const [showNoteModal, setShowNoteModal] = useState(false);
    const [existingNote, setExistingNote] = useState(null);
    const [showWordStudyModal, setShowWordStudyModal] = useState(false);
    const [wordStudyData, setWordStudyData] = useState(null);
    const [showChapterSummary, setShowChapterSummary] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const handleShareVerse = () => {
        setShowShareModal(true);
        setShowActionSheet(false); // Close the bottom sheet
    };

    // Parallel Reading (Split View) State
    const [isSplitView, setIsSplitView] = useState(false);
    const [secondVersion, setSecondVersion] = useState(null);
    const [secondVerses, setSecondVerses] = useState([]);

    // Scroll Synchronization Refs
    const primaryScrollRef = useRef(null);
    const secondaryScrollRef = useRef(null);
    const scrollDriver = useRef(null); // 'primary' or 'secondary'
    const scrollTimeout = useRef(null);
    const lastScrollCall = useRef(0);

    const handleScroll = (sourceName, source, target) => {
        if (!source.current) return;

        // Track scrolled state for floating navigation (Reader Mode)
        const currentScroll = source.current.scrollTop;
        if (currentScroll > 100 && !isScrolled) setIsScrolled(true);
        else if (currentScroll <= 100 && isScrolled) setIsScrolled(false);

        // Throttle to keep it performant
        const now = Date.now();
        if (now - lastScrollCall.current < 16) return;
        lastScrollCall.current = now;

        // Prevent feedback loops
        if (scrollDriver.current && scrollDriver.current !== sourceName) return;
        scrollDriver.current = sourceName;

        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

        // SYNC LOGIC & TRACKING: Find the FIRST visible verse at the top
        const sourceRect = source.current.getBoundingClientRect();
        const verseElements = source.current.querySelectorAll('.verse-item');

        let anchorVerse = null;

        for (const el of verseElements) {
            const rect = el.getBoundingClientRect();
            // Using a slightly more aggressive intersection check for instantaneous feel
            if (rect.bottom > sourceRect.top + 2) {
                anchorVerse = el;
                break;
            }
        }

        if (anchorVerse) {
            const parts = anchorVerse.id.split('-');
            const verseNum = parseInt(parts[parts.length - 1], 10);

            // Update tracking state (debounced by React batching mostly, effectively throttled by the scroll logic)
            if (sourceName === 'primary') {
                setCurrentScrollVerse(verseNum);
            }

            // --- Split View Sync Logic Below ---
            if (isSplitView && target.current) {
                const targetIdPrefix = sourceName === 'primary' ? 'v2-' : 'verse-';
                const targetElement = target.current.querySelector(`#${targetIdPrefix}${verseNum}`);

                if (targetElement) {
                    const anchorRect = anchorVerse.getBoundingClientRect();
                    const targetRectCurrent = targetElement.getBoundingClientRect();
                    const targetContainerRect = target.current.getBoundingClientRect();

                    // Alignment matching math
                    const sourceRelativeY = anchorRect.top - sourceRect.top;
                    const targetRelativeY = targetRectCurrent.top - targetContainerRect.top;
                    const correction = targetRelativeY - sourceRelativeY;

                    if (Math.abs(correction) > 0.5) {
                        target.current.scrollTop += correction;
                    }
                } else {
                    // Fallback percentage
                    const scrollPct = source.current.scrollTop / (source.current.scrollHeight - source.current.clientHeight);
                    target.current.scrollTop = scrollPct * (target.current.scrollHeight - target.current.clientHeight);
                }
            }
        } else if (sourceName === 'primary' && !scrollDriver.current) {
            // Fallback if anchorVerse logic above fails but we need to track local read
            const idx = getTopVerseIndex();
            if (verses[idx]) setCurrentScrollVerse(verses[idx].verse);
        }

        scrollTimeout.current = setTimeout(() => {
            scrollDriver.current = null;
        }, 120); // Faster handoff
    };

    // Listen for global event to exit reader mode (e.g. from BottomNav click)
    useEffect(() => {
        const handleExitReader = () => {
            setIsReaderMode(prev => {
                if (prev) return false;
                return prev;
            });
        };

        window.addEventListener('exit-reader-mode', handleExitReader);
        return () => window.removeEventListener('exit-reader-mode', handleExitReader);
    }, []); // No dependencies needed when using functional state updates

    useEffect(() => {
        loadBooks();
    }, []);

    // Handle navigation from search results or Profile
    useEffect(() => {
        // Ensure we have valid location state and books are loaded
        if (!location.state?.bookId) return;
        if (!books.all || books.all.length === 0) return;

        const { bookId, chapter, targetVerse } = location.state;
        // Use == for loose equality since bookId might be string and book.id integer
        const book = books.all.find(b => b.id == bookId);

        if (book) {
            console.log('📖 Navigation received:', book.name_full, 'Chapter:', chapter, 'Verse:', targetVerse);

            // Use a timeout to ensure state updates properly after render cycle
            setTimeout(() => {
                setSelectedBook(book);
                setSelectedChapter(chapter || 1);
                if (targetVerse) {
                    setTargetVerse(targetVerse);
                }
            }, 0);
        } else {
            console.warn('Book not found for ID:', bookId);
        }
    }, [location.key, books.all]); // Use location.key to detect new navigation

    useEffect(() => {
        if (selectedBook && currentVersion) {
            loadChapterCount();
            loadChapter();
        }
    }, [selectedBook, selectedChapter, currentVersion, isSplitView, secondVersion]);

    // Load highlights when chapter changes
    useEffect(() => {
        if (selectedBook && currentVersion) {
            loadHighlights();
        }
    }, [selectedBook, selectedChapter, currentVersion]);

    // Scroll to target verse after verses load
    useEffect(() => {
        // Only scroll when: we have a target, verses are loaded, and loading is complete
        if (targetVerse && verses.length > 0 && !loading) {
            console.log('🎯 Target verse set:', targetVerse, 'Verses loaded:', verses.length);
            // Delay to ensure DOM is fully rendered
            setTimeout(() => {
                console.log('🎯 Attempting to scroll to verse:', targetVerse);
                scrollToVerse(targetVerse);
                setTargetVerse(null); // Clear after scrolling
            }, 300);
        }
    }, [targetVerse, verses, loading]);

    // Save last reading position (Local + Cloud Sync)
    useEffect(() => {
        if (selectedBook && selectedChapter && currentVersion) {
            const now = Date.now();
            const state = {
                bookId: selectedBook.id,
                chapter: selectedChapter,
                version: currentVersion.id,
                secondaryVersion: secondVersion?.id,
                isSplitView,
                last_updated: now
            };

            localStorage.setItem('lastReadPosition', JSON.stringify(state));

            // Sync to cloud - PROTECT against overwriting newer cloud data
            // 1. Skip until initial check is finished
            // 2. Skip if a sync prompt is currently visible (waiting for user answer)
            if (!isFirstSyncDone || syncPrompt) {
                console.log('ℹ️ Cloud sync-back delayed:', !isFirstSyncDone ? 'Initial check pending' : 'Sync prompt active');
                return;
            }

            // [FIX] Checking existing storage to preserve 'verse' property if we are just reloading/switching versions
            // but staying in the same Chapter. This prevents the initial load (where currentScrollVerse might be 1)
            // from wiping out the saved verse before the scroll-restoration happens.
            let verseToSave = currentScrollVerse;
            const existingRaw = localStorage.getItem('lastReadPosition');
            if (existingRaw) {
                try {
                    const existing = JSON.parse(existingRaw);
                    if (existing.bookId == selectedBook.id && existing.chapter == selectedChapter && existing.verse) {
                        // If state thinks we are at different verse than storage (likely 1 vs 50 on load), keep storage
                        // UNLESS we are sure user has moved? (Hard to know, safer to preserve)
                        // Actually, if we preserve, we might be safe.
                        if (verseToSave === 1 && existing.verse > 1) {
                            verseToSave = existing.verse;
                        }
                    }
                } catch (e) { }
            }

            const newState = {
                bookId: selectedBook.id,
                chapter: selectedChapter,
                version: currentVersion.id,
                secondaryVersion: secondVersion?.id,
                isSplitView,
                verse: verseToSave, // Include verse in the main save
                last_updated: now
            };

            localStorage.setItem('lastReadPosition', JSON.stringify(newState));

            console.log('📡 Saving reading position to cloud:', selectedBook.name_full, selectedChapter, 'v.' + verseToSave);
            logBibleReading(selectedBook.id, selectedChapter);
            loadCategories();
        }
    }, [selectedBook, selectedChapter, currentVersion, secondVersion, isSplitView, isFirstSyncDone, syncPrompt]);

    // Separate effect to save VERSE position locally without triggering cloud syncs
    useEffect(() => {
        if (!currentScrollVerse || !selectedBook || !selectedChapter) return;

        const existingRaw = localStorage.getItem('lastReadPosition');
        let shouldSave = true;
        let dataToSave = {};

        if (existingRaw) {
            try {
                const existing = JSON.parse(existingRaw);
                // If we are on the same book/chapter
                if (existing.bookId == selectedBook.id && existing.chapter == selectedChapter) {

                    // ANTI-CORRUPTION CHECK:
                    // If state says "1" (default) but storage has something else (e.g. 50),
                    // ignore this update. It's likely the initial render before restoration.
                    if (currentScrollVerse === 1 && existing.verse > 1) {
                        shouldSave = false;
                    }

                    dataToSave = existing;
                } else {
                    // Changing books - safe to overwrite or start fresh, 
                    // but we should probably keep the rest of the state structure
                    dataToSave = existing; // Effectively we will overwrite the props we need
                }
            } catch (e) {
                console.warn('Failed to read local storage for update', e);
            }
        }

        if (shouldSave) {
            dataToSave.bookId = selectedBook.id;
            dataToSave.chapter = selectedChapter;
            dataToSave.verse = currentScrollVerse;
            dataToSave.last_updated = Date.now();

            // Ensure other fields are present if we started from scratch
            if (!dataToSave.version) dataToSave.version = currentVersion.id;

            localStorage.setItem('lastReadPosition', JSON.stringify(dataToSave));
        }
    }, [currentScrollVerse, selectedBook, selectedChapter]);

    // Check for Cloud Sync Continuity (Pick up where you left off)
    const checkCloudSync = async () => {
        if (!books.all || books.all.length === 0) return;

        console.log('🔄 Checking for newer reading position in cloud...');
        try {
            const result = await getLastReadState();
            if (result.success && result.state) {
                const cloudState = result.state;

                if (!cloudState.bookId || !cloudState.chapter) {
                    console.log('ℹ️ Cloud state empty.');
                    setIsFirstSyncDone(true);
                    return;
                }

                // IMPORTANT: Compare cloud against current LOCAL state (on screen)
                const isDifferent = (selectedBook?.id != cloudState.bookId || selectedChapter != cloudState.chapter);

                if (isDifferent) {
                    // Only prompt if cloud is actually newer based on timestamp
                    // or if we have no local timestamp yet (first load)
                    const cloudTime = cloudState.updated_at ? new Date(cloudState.updated_at).getTime() : 0;
                    const localStateRaw = localStorage.getItem('lastReadPosition');
                    const localTime = localStateRaw ? JSON.parse(localStateRaw).last_updated : 0;

                    if (cloudTime > localTime || !localTime) {
                        console.log('📡 Found newer cloud position:', cloudState.bookId, cloudState.chapter);
                        const book = books.all.find(b => b.id == cloudState.bookId);
                        if (book) {
                            setSyncPrompt({
                                bookId: cloudState.bookId,
                                chapter: cloudState.chapter,
                                title: `${getLocalizedBookName(book.name_full, currentVersion?.id)} ${cloudState.chapter}`,
                                bookObj: book
                            });
                            // Auto-dismiss after 30 seconds
                            setTimeout(() => setSyncPrompt(prev => prev?.bookId === cloudState.bookId ? null : prev), 30000);
                        }
                    } else {
                        console.log('ℹ️ Local is newer than cloud. Skipping prompt.');
                    }
                } else {
                    console.log('✅ Local and Cloud are in sync.');
                    if (syncPrompt) setSyncPrompt(null);
                }
            }
        } catch (err) {
            console.error('❌ Cloud sync check failed:', err);
        } finally {
            setIsFirstSyncDone(true);
        }
    };

    useEffect(() => {
        if (books.all?.length > 0) {
            checkCloudSync();
        }
    }, [books.all]);

    useEffect(() => {
        const handleSyncTrigger = () => {
            if (document.visibilityState === 'visible' && books.all?.length > 0) {
                checkCloudSync();
            }
        };
        window.addEventListener('focus', handleSyncTrigger);
        document.addEventListener('visibilitychange', handleSyncTrigger);
        return () => {
            window.removeEventListener('focus', handleSyncTrigger);
            document.removeEventListener('visibilitychange', handleSyncTrigger);
        };
    }, [books.all, selectedBook, selectedChapter]);

    const handleSyncAccept = () => {
        if (syncPrompt) {
            setSelectedBook(syncPrompt.bookObj);
            setSelectedChapter(syncPrompt.chapter);
            setSyncPrompt(null);
        }
    };

    const loadHighlights = async () => {
        if (!selectedBook || !currentVersion) return;
        const result = await getChapterHighlights(selectedBook.id, selectedChapter, currentVersion.id);
        if (result.success) {
            setHighlights(result.highlights);
        }
    };

    const loadCategories = async () => {
        const result = await getHighlightCategories();
        if (result.success) {
            setCategories(result.categories);
        }
    };


    useEffect(() => {
        if (verses.length > 0 && targetVerse) {
            scrollToVerse(targetVerse);
            setTargetVerse(null); // Reset after scroll
        }
    }, [verses, targetVerse]);

    // Close menu when scrolling or clicking elsewhere
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Improved Scroll to Verse with Retry
    const scrollToVerse = (verseNum, attempt = 1) => {
        const element = document.getElementById(`verse-${verseNum}`);
        const element2 = isSplitView ? document.getElementById(`v2-${verseNum}`) : null;

        console.log(`🎯 scrollToVerse attempt ${attempt} for:`, verseNum, 'Primary:', !!element, 'Secondary:', !!element2);

        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('highlight-verse');
            setTimeout(() => element.classList.remove('highlight-verse'), 2000);

            // Sync secondary if available
            if (element2) {
                element2.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (attempt < 5) {
            // Retry if element not found (DOM render delay)
            setTimeout(() => scrollToVerse(verseNum, attempt + 1), 200);
        }
    };

    const loadBooks = async () => {
        setLoading(true);
        setError(null);
        const result = await getBooks();
        if (result.success) {
            setBooks(result.data);

            // Handle Deep Link from Search or Default to Genesis
            if (location.state?.bookId) {
                const book = result.data.all.find(b => b.id == location.state.bookId);
                if (book) {
                    setSelectedBook(book);
                    if (location.state.chapter) setSelectedChapter(location.state.chapter);
                    if (location.state.targetVerse) setTargetVerse(location.state.targetVerse);
                    return; // Skip default
                }
            }

            // Check for last reading position
            const lastPosition = localStorage.getItem('lastReadPosition');
            if (lastPosition) {
                try {
                    const { bookId, chapter, version, secondaryVersion, isSplitView: wasSplit, verse } = JSON.parse(lastPosition);
                    const book = result.data.all.find(b => b.id == bookId);
                    if (book) {
                        console.log('📚 Restoring last reading position:', book.name_full, chapter);
                        setSelectedBook(book);
                        setSelectedChapter(chapter || 1);

                        if (wasSplit && secondaryVersion) {
                            const secVer = versions.find(v => v.id === secondaryVersion);
                            if (secVer) {
                                setSecondVersion(secVer);
                                setIsSplitView(true);
                            }
                        }


                        // Restore last verse
                        if (verse) {
                            console.log('📍 Restoring last verse:', verse);
                            setTargetVerse(verse);
                            setCurrentScrollVerse(verse); // [FIX] Sync state immediately
                        }
                        return; // Skip default
                    }
                } catch (e) {
                    console.warn('Error parsing last position', e);
                }
            }

            // Default to first book (Genesis)
            if (result.data.all.length > 0) {
                setSelectedBook(result.data.all[0]);
            }
        } else {
            console.error("Failed to load books:", result.error);
            setError("Failed to load Bible data. The database tables might be missing.");
        }
        setLoading(false);
    };

    const loadChapterCount = async (bookId) => {
        const id = bookId || (selectedBook ? selectedBook.id : null);
        if (!id) return;
        const result = await getChapterCount(id);
        if (result.success) {
            setChapterCount(result.data);
        }
    };

    const loadVerseCount = async (bookId, chapter) => {
        if (!bookId || !chapter) return;
        const result = await getVerseCount(bookId, chapter);
        if (result.success) {
            setVerseCount(result.data);
        }
    }

    const loadChapter = async () => {
        if (!selectedBook || !currentVersion) return;
        setLoading(true);
        // Clear verses prevents potential race conditions with auto-scroll looking at old verses
        setVerses([]);

        try {
            console.log(`[Reader] Loading chapter: ${selectedBook.id} ch.${selectedChapter} (${currentVersion.id}) split=${isSplitView}`);
            // Load main version
            const result = await getChapter(selectedBook.id, selectedChapter, currentVersion.id);
            if (result.success) {
                setVerses(result.data || []);
            }

            // Load second version if in split view
            if (isSplitView && secondVersion) {
                console.log(`[Reader] Loading secondary: ${secondVersion.id}`);
                const result2 = await getChapter(selectedBook.id, selectedChapter, secondVersion.id);
                if (result2.success) {
                    setSecondVerses(result2.data || []);
                }
            }
        } catch (err) {
            console.error("Error loading chapter:", err);
            setError("Failed to load verses.");
        } finally {
            setLoading(false);
        }
    };

    // Verse tap handler - original tap for simple selection maybe?
    // User requested specifically "Long Press" for highlighting.

    // Touch Handling State
    const isScrolling = useRef(false);
    const lastTouchTime = useRef(0);
    const longPressTimer = useRef(null);
    const lastTapTime = useRef(0);
    const lastTappedVerse = useRef(null);

    // Initial tap handler
    const handleVerseTap = (verse, e) => {
        // If we were scrolling, ignore the tap
        if (isScrolling.current) {
            isScrolling.current = false;
            return;
        }

        e.stopPropagation();

        // Double-tap detection (check FIRST, before text selection interferes)
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;
        const isSameVerse = lastTappedVerse.current === verse.verse;

        if (timeSinceLastTap < 400 && isSameVerse) {
            // Double-tap confirmed - open action sheet
            // Clear any auto-selection from browser
            window.getSelection()?.removeAllRanges();
            setSelectedVerses([verse]);
            setShowActionSheet(true);
            lastTapTime.current = 0;
            lastTappedVerse.current = null;
            return;
        }

        // Update tap tracking
        lastTapTime.current = now;
        lastTappedVerse.current = verse.verse;

        // For single tap, if there's a text selection, let it be (don't select verse)
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        setSelectedVerses(prev => {
            const isSelected = prev.some(v => v.verse === verse.verse);
            let next;
            if (isSelected) {
                next = prev.filter(v => v.verse !== verse.verse);
            } else {
                next = [...prev, verse].sort((a, b) => a.verse - b.verse);
            }

            // Only close action sheet if no verses selected
            if (next.length === 0) {
                setShowActionSheet(false);
            }
            return next;
        });
    };

    // Desktop double-click handler (more reliable than timing clicks)
    const handleVerseDoubleClick = (verse, e) => {
        e.preventDefault();
        e.stopPropagation();
        window.getSelection()?.removeAllRanges();
        setSelectedVerses([verse]);
        setShowActionSheet(true);
    };

    // Long press handler for premium feel
    const handleLongPress = (verse, e) => {
        // If scrolling, do not trigger long press
        if (isScrolling.current) return;

        if (e && e.preventDefault) {
            e.preventDefault();
        }
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }

        // Auto-select this verse and show action sheet
        setSelectedVerses([verse]);
        setShowActionSheet(true);

        // Haptic feedback if available
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
    };

    const handleTouchStart = (verse, e) => {
        isScrolling.current = false;
        lastTouchTime.current = Date.now();
        // Long press now allows native text selection (no timer)
    };

    const handleTouchMove = () => {
        // If moved, we are scrolling or panning, cancel long press
        isScrolling.current = true;
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        setTimeout(() => {
            isScrolling.current = false;
        }, 100);
    };

    const toggleSplitView = () => {
        if (!isSplitView && !secondVersion) {
            // Pick a default second version (different from current)
            const other = versions.find(v => v.id !== currentVersion.id);
            setSecondVersion(other);
        }
        setIsSplitView(!isSplitView);
    };

    const handleSecondVersionChange = (e) => {
        const verId = e.target.value;
        const ver = versions.find(v => v.id === verId);
        setSecondVersion(ver);
    };

    // Handle highlight color selection
    const handleHighlight = async (color) => {
        if (selectedVerses.length === 0 || !selectedBook || !currentVersion) return;

        // Log the trigger only - MOVED to highlightService.js
        // logActivity('verse_highlight');

        const promises = selectedVerses.map(v => {
            if (color === null) {
                return removeHighlight(selectedBook.id, selectedChapter, v.verse, currentVersion.id);
            } else {
                return saveHighlight(selectedBook.id, selectedChapter, v.verse, currentVersion.id, color);
            }
        });

        await Promise.all(promises);

        setHighlights(prev => {
            const updated = { ...prev };
            selectedVerses.forEach(v => {
                if (color === null) {
                    delete updated[v.verse];
                } else {
                    updated[v.verse] = color;
                }
            });
            return updated;
        });

        setShowActionSheet(false);
        setSelectedVerses([]);
    };

    const handleSaveCategory = async (color, label) => {
        const result = await saveHighlightCategory(color, label);
        if (result.success) {
            setCategories(prev => ({
                ...prev,
                [color]: label
            }));
        }
    };

    // Handle opening note modal
    const handleOpenNote = async () => {
        if (selectedVerses.length === 0 || !selectedBook || !currentVersion) return;

        logActivity('notes_visit');

        const primaryVerse = selectedVerses[0].verse;
        const result = await getVerseNote(selectedBook.id, selectedChapter, primaryVerse, currentVersion.id);
        setExistingNote(result.note);
        setShowActionSheet(false);
        setShowNoteModal(true);
    };

    // Handle saving note
    const handleSaveNote = async (noteText, studyId, labelIds) => {
        if (selectedVerses.length === 0 || !selectedBook || !currentVersion) return;

        const primaryVerse = selectedVerses[0].verse;
        await saveNote(selectedBook.id, selectedChapter, primaryVerse, currentVersion.id, noteText, studyId, labelIds);
        logActivity('note_created');
        setShowNoteModal(false);
        setSelectedVerses([]);
        setExistingNote(null);
    };

    // Handle starting inductive study
    const handleStartStudy = () => {
        if (selectedVerses.length === 0) return;

        // Log handled by InductiveEditor on mount
        // logActivity('study_page_visit');

        // Sort selected verses to get the range
        const sorted = [...selectedVerses].sort((a, b) => a.verse - b.verse);
        const verseStart = sorted[0].verse;
        const verseEnd = sorted[sorted.length - 1].verse;

        navigate('/study/new', {
            state: {
                book_id: selectedBook.id,
                book_name: selectedBook.name_full,
                chapter: selectedChapter,
                verse_start: verseStart,
                verse_end: verseEnd
            }
        });
        handleCloseActionSheet();
    };

    const handleWordStudy = async () => {
        if (selectedVerses.length === 0) return;

        logActivity('word_study_visit');
        const firstVerse = selectedVerses[0];

        // Fetch original text for the first selected verse
        const result = await getOriginalVerse(selectedBook.id, selectedChapter, firstVerse.verse);
        if (result.success) {
            setWordStudyData({
                verse: firstVerse,
                originalText: result.text,
                originalVersion: result.version,
                ref: getVerseRef()
            });
            setShowWordStudyModal(true);
        } else {
            alert('Original language text not available for this verse.');
        }
        handleCloseActionSheet();
    };

    // Close action sheet
    const handleCloseActionSheet = () => {
        setShowActionSheet(false);
        setSelectedVerses([]);
    };

    // Get verse reference string
    const getVerseRef = () => {
        if (selectedVerses.length === 0) return '';
        const bookName = getLocalizedBookName(selectedBook?.name_full, currentVersion?.id);
        const versesSorted = [...selectedVerses].sort((a, b) => a.verse - b.verse);
        const start = versesSorted[0].verse;
        const end = versesSorted[versesSorted.length - 1].verse;

        if (start === end) {
            return `${bookName} ${selectedChapter}:${start} `;
        }
        return `${bookName} ${selectedChapter}:${start} -${end} `;
    };

    // --- Search / Context Menu Logic ---
    useEffect(() => {
        let timeout;

        const handleSelectionChange = () => {
            // Clear any pending update
            clearTimeout(timeout);

            // Debounce to allow selection to settle (especially on mobile)
            timeout = setTimeout(() => {
                const selection = window.getSelection();
                const text = selection.toString().trim();

                if (text.length > 0 && selection.rangeCount > 0) {
                    try {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();

                        // Check if selection is actually within our specific app area (optional but good)
                        // For now we just check if it's visible on screen
                        if (rect.width > 0 && rect.height > 0) {
                            // Calculate position (centered BELOW selection)
                            const bottomPos = rect.bottom + 10;

                            setContextMenu({
                                visible: true,
                                x: rect.left + (rect.width / 2),
                                y: bottomPos,
                                text: text,
                                step: 'initial'
                            });
                        }
                    } catch (e) {
                        // Range might be invalid in some edge cases
                        console.debug('Selection range error', e);
                    }
                } else {
                    // Hide menu if selection is cleared (but don't hide if clicking the menu itself handled by handleClickOutside)
                    // Actually, if we clear selection, we SHOULD hide it.
                    // But on mobile, clicking the button might clear selection first?
                    // Let's rely on the fact that if text is empty, we don't necessarily force hide immediately 
                    // unless we want to "live update".
                    // Better UX: If text is empty, hide it.
                    // setContextMenu(prev => ({ ...prev, visible: false }));
                    // NOTE: Hiding here causes the menu to disappear before click registers if the button click clears selection.
                    // We will let the `handleClickOutside` or execution of search handle the closing.
                }
            }, 200); // 200ms delay to let mobile selection bubbles appear/disappear
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            clearTimeout(timeout);
        };
    }, []);

    const showSearchOptions = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu(prev => ({ ...prev, step: 'options' }));
    };

    const searchSelection = (testament = 'all') => {
        if (contextMenu.text) {
            navigate(`/search?q=${encodeURIComponent(contextMenu.text)}&version=${currentVersion?.id || 'all'}&testament=${testament}`);
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    };
    // -----------------------------------

    const handleBookClick = (book) => {
        setTempSelectedBook(book);
        loadChapterCount(book.id); // Pre-fetch chapter count
        setSelectionStage('chapters');
    };

    const handleChapterClick = (chapter) => {
        setTempSelectedChapter(chapter);
        loadVerseCount(tempSelectedBook.id, chapter); // Pre-fetch verse count
        setSelectionStage('verses');
    };

    const handleVerseClick = (verse) => {
        // Finalize selection
        setSelectedBook(tempSelectedBook);
        setSelectedChapter(tempSelectedChapter);
        setTargetVerse(verse); // Set target for scrolling

        // Reset and close
        setSelectionStage('books');
        setShowBookSelector(false);
    };

    const handleBack = () => {
        if (selectionStage === 'verses') setSelectionStage('chapters');
        else if (selectionStage === 'chapters') setSelectionStage('books');
    };

    const openBookSelector = () => {
        setSelectionStage('books');
        setTempSelectedBook(selectedBook);
        setShowBookSelector(!showBookSelector);
    };

    const handlePrevChapter = () => {
        if (selectedChapter > 1) {
            setSelectedChapter(selectedChapter - 1);
            setTargetVerse(1); // Scroll to top
        }
    };

    // --- Audio Player Logic ---
    const [showAudioPlayer, setShowAudioPlayer] = useState(false);
    // Lazy load the player to avoid loading speech API if unused
    const [AudioPlayerComp, setAudioPlayerComp] = useState(null);

    useEffect(() => {
        if (showAudioPlayer && !AudioPlayerComp) {
            import('./AudioPlayer').then(module => {
                setAudioPlayerComp(() => module.default);
            });
        }
    }, [showAudioPlayer, AudioPlayerComp]);

    const handleNextChapter = () => {
        if (selectedChapter < chapterCount) {
            setSelectedChapter(selectedChapter + 1);
            setTargetVerse(1);
        } else {
            // Try next book (Auto-advance Logic)
            const currentBookIndex = books.all.findIndex(b => b.id === selectedBook.id);
            if (currentBookIndex !== -1 && currentBookIndex < books.all.length - 1) {
                console.log('📖 Auto-advancing to next book...');
                const nextBook = books.all[currentBookIndex + 1];
                setSelectedBook(nextBook);
                setSelectedChapter(1);
                setTargetVerse(1);
            } else {
                console.log('End of Bible reached');
            }
        }
    };

    const handleVersionChange = (e) => {
        const versionId = e.target.value; // IDs are strings now
        const version = versions.find(v => v.id === versionId);
        if (version) {
            setCurrentVersion(version);
            // Save to localStorage so it persists
            localStorage.setItem('lastBibleVersion', version.id);
        }
    };

    // Helper to find which verse is currently at the top of the viewport
    const getTopVerseIndex = () => {
        const container = primaryScrollRef.current;
        if (!container) return 0;

        const containerRect = container.getBoundingClientRect();
        const verseElements = container.querySelectorAll('.verse-item');

        for (let i = 0; i < verseElements.length; i++) {
            const rect = verseElements[i].getBoundingClientRect();
            // If the bottom of the verse is below the top of the container (+ small buffer)
            if (rect.bottom > containerRect.top + 10) {
                // Return index (matching the verses array which is 0-indexed)
                return i;
            }
        }
        return 0;
    };

    if (error) {
        return (
            <div className="bible-reader error-state">
                <div className="error-content">
                    <h2>⚠️ Connection Error</h2>
                    <p>{error}</p>
                    <p className="error-hint">Please check if the `books` table exists in Supabase.</p>
                    <button className="btn-primary" onClick={loadBooks}>Retry</button>
                </div>
            </div>
        );
    }

    // --- Red Letter Helper ---
    const renderVerseText = (verse) => {
        if (!verse.red_letters || verse.red_letters.length === 0) return verse.text;

        // Special handling for Red Letters if available in the version data
        const parts = [];
        let lastIdx = 0;

        // Sort red letters by position to handle them in order
        const sortedRed = [...verse.red_letters].sort((a, b) => a.start - b.start);

        sortedRed.forEach((red, i) => {
            // Text before red
            if (red.start > lastIdx) {
                parts.push(verse.text.substring(lastIdx, red.start));
            }
            // Red text
            parts.push(<span key={i} className="red-letter">{verse.text.substring(red.start, red.end)}</span>);
            lastIdx = red.end;
        });

        // Remaining text
        if (lastIdx < verse.text.length) {
            parts.push(verse.text.substring(lastIdx));
        }

        return parts;
    };

    // --- Version Categorization Helper ---
    const renderVersionOptions = () => {
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

        const result = [];
        if (groups.English.length > 0) {
            result.push(
                <optgroup key="en" label="English - english versions">
                    {groups.English.map(v => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
                </optgroup>
            );
        }
        if (groups.Afrikaans.length > 0) {
            result.push(
                <optgroup key="af" label="Afrikaans - afrikaans versions">
                    {groups.Afrikaans.map(v => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
                </optgroup>
            );
        }
        if (groups.Xhosa.length > 0) {
            result.push(
                <optgroup key="xh" label="Xhosa">
                    {groups.Xhosa.map(v => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
                </optgroup>
            );
        }
        return result;
    };

    const handleSummaryClick = async () => {
        const uid = await getUserId();
        if (uid && uid.startsWith('user_')) {
            const promptMsg = settings.language === 'af'
                ? 'Om Hoofstuk Opsommings te sien, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                : 'To see Chapter Summaries, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

            if (window.confirm(promptMsg)) {
                navigate('/auth');
            }
            return;
        }
        setShowChapterSummary(true);
    };

    return (
        <div className="bible-reader">
            {/* Header */}
            <div className="bible-header">
                <div className="header-top">
                    <div className="header-left">
                        <button className="info-btn icon-btn" onClick={() => setShowInfo(true)} title="App Info">ℹ️</button>
                        <h1
                            className="app-title"
                            onClick={() => setShowDefinition(true)}
                            style={{ cursor: 'pointer' }}
                            title="Click to see what Omni means"
                        >
                            Omni Bible
                        </h1>
                    </div>
                    <div className="header-right">
                        {/* Audio Toggle - Hidden for Afrikaans/Xhosa due to missing TTS support on some devices */}
                        {(!['af', 'xh'].includes(currentVersion?.language)) && (
                            <button
                                className={`info-btn icon-btn audio-toggle-btn ${showAudioPlayer ? 'active' : ''}`}
                                onClick={() => setShowAudioPlayer(!showAudioPlayer)}
                                title="Audio Bible"
                                style={{ fontSize: '1.2rem', marginRight: '4px' }}
                            >
                                {showAudioPlayer ? '🎧' : '🔈'}
                            </button>
                        )}
                        <select
                            className="version-selector select"
                            value={currentVersion?.id || ''}
                            onChange={handleVersionChange}
                        >
                            {renderVersionOptions()}
                        </select>
                    </div>
                </div>

                <div className="reading-controls">
                    {location.state?.fromSearch && (
                        <button
                            className="book-selector-btn btn-secondary"
                            onClick={() => {
                                const sp = location.state?.searchParams;
                                if (sp) {
                                    const params = new URLSearchParams();
                                    if (sp.q) params.set('q', sp.q);
                                    if (sp.version) params.set('version', sp.version);
                                    if (sp.testament) params.set('testament', sp.testament);
                                    if (sp.mode) params.set('mode', sp.mode);
                                    navigate(`/search?${params.toString()}`);
                                } else {
                                    navigate('/search');
                                }
                            }}
                            style={{ marginRight: '8px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}
                        >
                            ⬅ {settings.language === 'af' ? 'Terug' : 'Back'}
                        </button>
                    )}
                    <button
                        className="book-selector-btn btn-secondary"
                        onClick={openBookSelector}
                    >
                        {selectedBook ? getLocalizedBookName(selectedBook.name_full, currentVersion?.id) : 'Select Book'}
                    </button>

                    <div className="chapter-nav">
                        <button
                            className="chapter-btn btn-secondary"
                            onClick={handlePrevChapter}
                            disabled={selectedChapter <= 1}
                        >
                            ‹
                        </button>
                        <span className="chapter-display" onClick={() => {
                            setTempSelectedBook(selectedBook);
                            setSelectionStage('chapters');
                            setShowBookSelector(true);
                        }}>
                            {['AFR53', 'AFR83'].includes(currentVersion?.id) ? 'Hoofstuk' : 'Chapter'} {selectedChapter}
                        </span>
                        <button
                            className="chapter-btn btn-secondary"
                            onClick={handleNextChapter}
                            disabled={selectedChapter >= chapterCount}
                        >
                            ›
                        </button>

                        <div className="nav-divider"></div>

                        <button className="nav-quick-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
                        <button className="nav-quick-btn" onClick={handleSummaryClick} title="Chapter Summary">📝</button>
                        <button
                            className={`split-view-toggle ${isSplitView ? 'active' : ''}`}
                            onClick={toggleSplitView}
                            title={settings.language === 'af' ? 'Parallelle Lees' : 'Parallel Reading'}
                        >
                            {isSplitView ? '📖📖' : '📖'}
                        </button>

                        <button
                            className={`expand-toggle-btn ${isReaderMode ? 'active' : ''}`}
                            onClick={() => setIsReaderMode(!isReaderMode)}
                            title={isReaderMode ? "Exit Reader Mode" : "Expand to Reader Mode"}
                        >
                            {isReaderMode ? '🤏' : '↔️'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Smart Sync Banner */}
            {syncPrompt && (
                <div className="sync-banner">
                    <div className="sync-content">
                        <span className="sync-icon">🔄</span>
                        <p>{settings.language === 'af' ? 'Gaan voort met' : 'Continue reading'} <strong>{syncPrompt.title}</strong>?</p>
                    </div>
                    <div className="sync-actions">
                        <button className="sync-btn sync-accept" onClick={handleSyncAccept}>
                            {settings.language === 'af' ? 'Hervat' : 'Resume'}
                        </button>
                        <button className="sync-btn sync-dismiss" onClick={() => setSyncPrompt(null)}>
                            ✕
                        </button>
                    </div>
                </div>
            )}
            {/* Reader Mode Navigation Overlay */}
            {isReaderMode && (
                <div className={`reader-overlay ${showReaderControls ? 'show-controls' : ''}`}>
                    <div className="nav-zone edge-left" onClick={handlePrevChapter} title="Previous Chapter">
                        <span className="nav-handle">‹</span>
                    </div>
                    <div className="nav-zone edge-right" onClick={handleNextChapter} title="Next Chapter">
                        <span className="nav-handle">›</span>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    className="context-menu-tooltip"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        transform: 'translate(-50%, 0)',
                        zIndex: 1000
                    }}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent document click from closing it
                >
                    {contextMenu.step === 'initial' ? (
                        <button className="context-search-btn" onClick={showSearchOptions}>
                            🔍 Search "{contextMenu.text.length > 20 ? contextMenu.text.substring(0, 20) + '...' : contextMenu.text}"
                        </button>
                    ) : (
                        <div className="context-options-row">
                            <span className="context-label">Search in:</span>
                            <button className="context-option-btn" onClick={() => searchSelection('all')}>Both</button>
                            <button className="context-option-btn" onClick={() => searchSelection('OT')}>Old Test.</button>
                            <button className="context-option-btn" onClick={() => searchSelection('NT')}>New Test.</button>
                        </div>
                    )}
                </div>
            )}

            {/* Book Selector Modal (Multi-Stage) */}
            {showBookSelector && (
                <div className="book-selector-modal" onClick={() => setShowBookSelector(false)}>
                    <div className="book-selector-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-group">
                                {selectionStage !== 'books' && (
                                    <button
                                        className="back-navigator"
                                        onClick={() => setSelectionStage(selectionStage === 'verses' ? 'chapters' : 'books')}
                                    >
                                        ⬅
                                    </button>
                                )}
                                <h3>
                                    {selectionStage === 'books' && (settings.language === 'af' ? 'Kies Boek' : 'Select Book')}
                                    {selectionStage === 'chapters' && (settings.language === 'af' ? `Kies Hoofstuk (${tempSelectedBook?.name_full})` : `Select Chapter (${tempSelectedBook?.name_full})`)}
                                    {selectionStage === 'verses' && (settings.language === 'af' ? `Kies Vers (${tempSelectedBook?.name_full} ${tempSelectedChapter})` : `Select Verse (${tempSelectedBook?.name_full} ${tempSelectedChapter})`)}
                                </h3>
                            </div>
                            <button className="close-btn" onClick={() => setShowBookSelector(false)}>✕</button>
                        </div>

                        <div className="selection-body">
                            {selectionStage === 'books' && (
                                <div className="testaments-grid">
                                    <div className="testament-section">
                                        <h4 className="testament-title">Old Testament</h4>
                                        <div className="books-grid">
                                            {books.oldTestament.map(book => (
                                                <button
                                                    key={book.id}
                                                    className={`book-item ${selectedBook?.id === book.id ? 'active' : ''}`}
                                                    onClick={() => handleBookClick(book)}
                                                >
                                                    {getLocalizedBookName(book.name_full, currentVersion?.id)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="testament-section">
                                        <h4 className="testament-title">New Testament</h4>
                                        <div className="books-grid">
                                            {books.newTestament.map(book => (
                                                <button
                                                    key={book.id}
                                                    className={`book-item ${selectedBook?.id === book.id ? 'active' : ''}`}
                                                    onClick={() => handleBookClick(book)}
                                                >
                                                    {getLocalizedBookName(book.name_full, currentVersion?.id)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectionStage === 'chapters' && (
                                <div className="number-grid">
                                    {Array.from({ length: chapterCount }, (_, i) => i + 1).map(num => (
                                        <button
                                            key={num}
                                            className={`number-item ${selectedChapter === num ? 'active' : ''}`}
                                            onClick={() => handleChapterClick(num)}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectionStage === 'verses' && (
                                <div className="number-grid">
                                    {Array.from({ length: verseCount || 1 }, (_, i) => i + 1).map(num => (
                                        <button
                                            key={num}
                                            className="number-item"
                                            onClick={() => handleVerseClick(num)}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Content Display */}
            <div className={`bible-reader-main ${isSplitView ? 'split-active' : ''}`} onClick={(e) => {
                // Global click handler to close tooltips/menus
                if (contextMenu.visible) setContextMenu({ ...contextMenu, visible: false });
            }}>
                <div className={`bible-column primary-column ${isSplitView ? 'split-mode' : ''}`}>
                    {isSplitView && (
                        <div className="pane-version-label">
                            <span className="badge">{currentVersion?.abbreviation}</span>
                        </div>
                    )}
                    {loading ? (
                        <div className="loading-state">
                            <div className="loading-spinner"></div>
                            <p>Loading {currentVersion?.abbreviation}...</p>
                        </div>
                    ) : (
                        <div
                            className="verses-container"
                            style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}
                            ref={primaryScrollRef}
                            onScroll={() => handleScroll('primary', primaryScrollRef, secondaryScrollRef)}
                        >
                            <h1 className="chapter-title">
                                {getLocalizedBookName(selectedBook?.name_full, currentVersion?.id)} {selectedChapter}
                                <span className="version-badge">{currentVersion?.abbreviation}</span>

                                {/* Reader Mode Navigation Buttons */}
                                {isReaderMode && (
                                    <div className={`reader-nav-top ${isScrolled ? 'floating' : ''}`}>
                                        <button
                                            className="reader-nav-btn prev"
                                            onClick={(e) => { e.stopPropagation(); handlePrevChapter(); }}
                                            disabled={selectedChapter <= 1}
                                            title="Previous Chapter"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            className="reader-nav-btn next"
                                            onClick={(e) => { e.stopPropagation(); handleNextChapter(); }}
                                            disabled={selectedChapter >= chapterCount}
                                            title="Next Chapter"
                                        >
                                            ›
                                        </button>
                                        <div className="reader-nav-divider"></div>
                                        <button className="reader-nav-btn icon" onClick={(e) => { e.stopPropagation(); setShowSettings(true); }} title="Settings">⚙️</button>
                                        <button className="reader-nav-btn icon" onClick={(e) => { e.stopPropagation(); handleSummaryClick(); }} title="Chapter Summary">📝</button>
                                        <button className="reader-nav-btn icon exit" onClick={(e) => { e.stopPropagation(); setIsReaderMode(false); }} title="Exit Reader Mode">🤏</button>
                                    </div>
                                )}
                            </h1>

                            <div className="verses-list">
                                {/* Uniqueness filter to prevent duplications seen in some versions */}
                                {Array.from(new Set(verses.map(v => v.verse))).map(verseNum => {
                                    const verse = verses.find(v => v.verse === verseNum);
                                    if (!verse) return null;

                                    return (
                                        <div
                                            key={verse.id || `verse-${verse.verse}`}
                                            id={`verse-${verse.verse}`}
                                            className={`verse-item ${selectedVerses.some(v => v.verse === verse.verse) ? 'verse-selected' : ''}`}
                                            onContextMenu={(e) => e.preventDefault()}

                                            onTouchStart={(e) => handleTouchStart(verse, e)}
                                            onTouchMove={handleTouchMove}
                                            onTouchEnd={handleTouchEnd}
                                            onClick={(e) => handleVerseTap(verse, e)}
                                            onDoubleClick={(e) => handleVerseDoubleClick(verse, e)}
                                        >
                                            <span className="verse-number">{verse.verse}</span>
                                            <span
                                                className="verse-text"
                                                style={{
                                                    backgroundColor: hexToRgba(highlights[verse.verse], 0.3),
                                                    boxShadow: highlights[verse.verse] ? `0 0 10px 4px ${hexToRgba(highlights[verse.verse], 0.3)}` : 'none'
                                                }}
                                                onClick={(e) => handleVerseTap(verse, e)}
                                            >
                                                {renderVerseText(verse)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {isSplitView && <div className="split-divider"></div>}

                {isSplitView && secondVersion && (
                    <div className="bible-column secondary-column">
                        <div className="pane-version-label">
                            <select
                                className="version-selector select secondary-version-select"
                                value={secondVersion?.id || ''}
                                onChange={handleSecondVersionChange}
                            >
                                {versions.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.abbreviation}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {loading ? (
                            <div className="loading-state">
                                <div className="loading-spinner"></div>
                            </div>
                        ) : (
                            <div
                                className="verses-container secondary-verses"
                                style={{ fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}
                                ref={secondaryScrollRef}
                                onScroll={() => handleScroll('secondary', secondaryScrollRef, primaryScrollRef)}
                            >
                                <div className="verses-list">
                                    {Array.from(new Set(secondVerses.map(v => v.verse))).map(verseNum => {
                                        const verse = secondVerses.find(v => v.verse === verseNum);
                                        if (!verse) return null;
                                        return (
                                            <div
                                                key={verse.id || `v2-${verse.verse}`}
                                                id={`v2-${verse.verse}`}
                                                className={`verse-item ${selectedVerses.some(v => v.verse === verse.verse) ? 'verse-selected' : ''}`}
                                                onContextMenu={(e) => e.preventDefault()}
                                                onTouchStart={(e) => handleTouchStart(verse, e)}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                                onClick={(e) => handleVerseTap(verse, e)}
                                                onDoubleClick={(e) => handleVerseDoubleClick(verse, e)}
                                            >
                                                <span className="verse-number">{verse.verse}</span>
                                                <span
                                                    className="verse-text"
                                                    style={{
                                                        backgroundColor: hexToRgba(highlights[verse.verse], 0.3),
                                                        boxShadow: highlights[verse.verse] ? `0 0 10px 4px ${hexToRgba(highlights[verse.verse], 0.3)}` : 'none'
                                                    }}
                                                >
                                                    {verse.text}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Omni Definition Modal */}
            {
                showDefinition && (
                    <OmniDefinitionModal
                        onClose={() => setShowDefinition(false)}
                    />
                )
            }

            {/* Chapter Summary Modal */}
            <ChapterSummaryModal
                isOpen={showChapterSummary}
                onClose={() => setShowChapterSummary(false)}
                bookName={selectedBook?.name_full}
                chapter={selectedChapter}
                verses={verses}
                language={settings.language}
            />

            {/* Info / Help Modal */}
            {
                showInfo && (
                    <BibleHelpModal
                        onClose={() => setShowInfo(false)}
                        language={settings.language}
                    />
                )
            }

            {/* Settings Modal */}
            {
                showSettings && (
                    <div className="book-selector-modal" onClick={() => setShowSettings(false)}>
                        <div className="book-selector-content info-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="header-title-row">
                                    <h2>Reader Settings ⚙️</h2>
                                    <button
                                        className="refresh-btn-icon"
                                        onClick={resetAppCache}
                                        title="Refresh App"
                                    >🔄 <span>Refresh App</span></button>
                                </div>
                                <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
                            </div>
                            <div className="modal-body info-body">

                                {/* Live Preview */}
                                <div
                                    className="settings-preview"
                                    style={{
                                        fontSize: `${settings.fontSize}px`,
                                        fontFamily: settings.fontFamily === 'serif' ? '"Merriweather", "Times New Roman", serif' : 'system-ui, -apple-system, sans-serif',
                                        borderLeft: `4px solid ${settings.themeColor}`
                                    }}
                                >
                                    <p>In the beginning God created the heaven and the earth.</p>
                                </div>

                                <div className="info-section">
                                    <h3>Text Size: {settings.fontSize}px</h3>
                                    <div className="settings-control">
                                        <button
                                            className="settings-btn"
                                            onClick={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 2) })}
                                        >A-</button>
                                        <input
                                            type="range"
                                            min="12"
                                            max="32"
                                            step="2"
                                            value={settings.fontSize}
                                            onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                                            className="settings-slider"
                                        />
                                        <button
                                            className="settings-btn"
                                            onClick={() => updateSettings({ fontSize: Math.min(32, settings.fontSize + 2) })}
                                        >A+</button>
                                    </div>
                                </div>

                                <div className="info-section">
                                    <h3>Font Style</h3>
                                    <div className="settings-control">
                                        <button
                                            className={`settings-toggle ${settings.fontFamily === 'sans-serif' ? 'active' : ''}`}
                                            onClick={() => updateSettings({ fontFamily: 'sans-serif' })}
                                        >Modern (Sans)</button>
                                        <button
                                            className={`settings-toggle ${settings.fontFamily === 'serif' ? 'active' : ''}`}
                                            onClick={() => updateSettings({ fontFamily: 'serif' })}
                                            style={{ fontFamily: 'serif' }}
                                        >Classic (Serif)</button>
                                    </div>
                                </div>



                                <div className="info-section">
                                    <h3>Theme Color</h3>
                                    <div className="color-grid">
                                        {THEME_COLORS.map(color => (
                                            <button
                                                key={color}
                                                className={`color-swatch ${settings.themeColor === color ? 'active' : ''}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => updateSettings({ themeColor: color })}
                                                aria-label={`Select color ${color}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Verse Action Sheet */}
            {
                showActionSheet && selectedVerses.length > 0 && (
                    <VerseActionSheet
                        verse={selectedVerses[0]}
                        verseText={selectedVerses.length === 1 ? selectedVerses[0].text : ''}
                        verseRef={getVerseRef()}
                        currentColor={selectedVerses.length === 1 ? highlights[selectedVerses[0].verse] : null}
                        categories={categories}
                        onHighlight={handleHighlight}
                        onSaveCategory={handleSaveCategory}
                        onNote={handleOpenNote}
                        onWordStudy={handleWordStudy}
                        onStudy={handleStartStudy}
                        onCopy={() => { }}
                        onShare={handleShareVerse}
                        onClose={handleCloseActionSheet}
                    />
                )
            }

            {/* Note Modal */}
            {
                showNoteModal && selectedVerses.length > 0 && (
                    <NoteModal
                        verse={selectedVerses[0]}
                        verseText={selectedVerses[0].text}
                        verseRef={getVerseRef()}
                        existingNote={existingNote}
                        onSave={handleSaveNote}
                        onClose={() => {
                            setShowNoteModal(false);
                            setSelectedVerses([]);
                            setExistingNote(null);
                        }}
                    />
                )
            }

            {
                showWordStudyModal && wordStudyData && (
                    <WordStudyModal
                        verse={wordStudyData.verse}
                        verseText={wordStudyData.verse.text}
                        verseRef={wordStudyData.ref}
                        originalText={wordStudyData.originalText}
                        originalVersion={wordStudyData.originalVersion}
                        onClose={() => {
                            setShowWordStudyModal(false);
                            setWordStudyData(null);
                            setSelectedVerses([]);
                        }}
                    />
                )
            }

            {/* Share Image Modal */}
            {
                showShareModal && selectedVerses.length > 0 && (
                    <ShareImageModal
                        verses={selectedVerses}
                        bookName={selectedBook?.name_full}
                        chapter={selectedChapter}
                        language={settings.language}
                        onClose={() => setShowShareModal(false)}
                    />
                )
            }

            {/* Audio Player Overlay */}
            {
                showAudioPlayer && AudioPlayerComp && (
                    <AudioPlayerComp
                        verses={verses}
                        currentChapter={selectedChapter}
                        bookName={selectedBook?.name_full}
                        onNextChapter={handleNextChapter}
                        onHighlightVerse={(verseNum) => {
                            scrollToVerse(verseNum);
                        }}
                        onClose={() => setShowAudioPlayer(false)}
                        initialVerseIndex={getTopVerseIndex()}
                        onGetTopVerseIndex={getTopVerseIndex}
                    />
                )
            }
        </div >
    );
}

export default BibleReader;
