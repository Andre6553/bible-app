import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WordStudyModal from './WordStudyModal';
import {
    getChapter,
    getVersions,
    getBooks,
    getUserId,
    getOriginalVerse,
    getChapterCount,
    getVerseCount
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

const THEME_COLORS = [
    '#6366f1', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
    '#78716c', '#d97706'
];

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

    // Reader Mode State
    const [isReaderMode, setIsReaderMode] = useState(false);
    const [showReaderControls, setShowReaderControls] = useState(true);

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

    // Parallel Reading (Split View) State
    const [isSplitView, setIsSplitView] = useState(false);
    const [secondVersion, setSecondVersion] = useState(null);
    const [secondVerses, setSecondVerses] = useState([]);

    // Scroll Synchronization Refs
    const primaryScrollRef = useRef(null);
    const secondaryScrollRef = useRef(null);
    const isSyncingScroll = useRef(false);

    const handleScroll = (source, target) => {
        if (!isSplitView || isSyncingScroll.current) return;
        if (!source.current || !target.current) return;

        isSyncingScroll.current = true;

        // Calculate the percentage scrolled in the source
        const sourceScrollTop = source.current.scrollTop;
        const sourceScrollHeight = source.current.scrollHeight - source.current.clientHeight;
        const scrollPercentage = sourceScrollTop / sourceScrollHeight;

        // Apply same percentage to the target
        const targetScrollHeight = target.current.scrollHeight - target.current.clientHeight;
        target.current.scrollTop = scrollPercentage * targetScrollHeight;

        // Reset the flag after a short timeout to prevent feedback loops
        setTimeout(() => {
            isSyncingScroll.current = false;
        }, 50);
    };

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

    // Save last reading position
    useEffect(() => {
        if (selectedBook && selectedChapter && currentVersion) {
            localStorage.setItem('lastReadPosition', JSON.stringify({
                bookId: selectedBook.id,
                chapter: selectedChapter,
                version: currentVersion.id,
                secondaryVersion: secondVersion?.id,
                isSplitView
            }));
            loadCategories();
        }
    }, [selectedBook, selectedChapter, currentVersion, secondVersion, isSplitView]);

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

    const scrollToVerse = (verseNum) => {
        const element = document.getElementById(`verse-${verseNum}`);
        console.log('🎯 scrollToVerse called for:', verseNum, 'Element found:', !!element);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add highlight effect
            element.classList.add('highlight-verse');
            setTimeout(() => element.classList.remove('highlight-verse'), 2000);
        }
    };

    const loadBooks = async () => {
        setLoading(true);
        setError(null);
        const result = await getBooks();
        if (result.success) {
            setBooks(result.data);
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
                    const { bookId, chapter, version, secondaryVersion, isSplitView: wasSplit } = JSON.parse(lastPosition);
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

        try {
            // Load main version
            const result = await getChapter(selectedBook.id, selectedChapter, currentVersion.id);
            if (result.success) {
                setVerses(result.data || []);
            }

            // Load second version if in split view
            if (isSplitView && secondVersion) {
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
    const handleVerseTap = (verse, e) => {
        // Simple tap toggles selection/action sheet
        e.stopPropagation();

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

            if (next.length > 0) {
                setShowActionSheet(true);
            } else {
                setShowActionSheet(false);
            }
            return next;
        });
    };

    // Long press handler for premium feel
    const handleLongPress = (verse, e) => {
        e.preventDefault();
        e.stopPropagation();

        // Auto-select this verse and show action sheet
        setSelectedVerses([verse]);
        setShowActionSheet(true);

        // Haptic feedback if available
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
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
        setShowNoteModal(false);
        setSelectedVerses([]);
        setExistingNote(null);
    };

    // Handle starting inductive study
    const handleStartStudy = () => {
        if (selectedVerses.length === 0) return;

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

    const handleNextChapter = () => {
        if (selectedChapter < chapterCount) {
            setSelectedChapter(selectedChapter + 1);
            setTargetVerse(1); // Scroll to top
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
        return verse.text;
    };

    return (
        <div className="bible-reader">
            {/* Header */}
            <div className="bible-header">
                <div className="header-top">
                    <div className="header-left">
                        <button className="info-btn icon-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
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
                        <button
                            className={`info-btn icon-btn expand-toggle ${isReaderMode ? 'active' : ''}`}
                            onClick={() => setIsReaderMode(!isReaderMode)}
                            title={isReaderMode ? "Exit Reader Mode" : "Expand to Reader Mode"}
                        >
                            {isReaderMode ? '🤏' : '↔️'}
                        </button>
                        <select
                            className="version-selector select"
                            value={currentVersion?.id || ''}
                            onChange={handleVersionChange}
                        >
                            {versions.map(version => (
                                <option key={version.id} value={version.id}>
                                    {version.abbreviation}
                                </option>
                            ))}
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
                        onClick={() => setShowBookSelector(!showBookSelector)}
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

                        <button
                            className={`split-view-toggle ${isSplitView ? 'active' : ''}`}
                            onClick={toggleSplitView}
                            title={settings.language === 'af' ? 'Parallelle Lees' : 'Parallel Reading'}
                            style={{ marginLeft: '8px' }}
                        >
                            {isSplitView ? '📖📖' : '📖'}
                        </button>

                        {isSplitView && (
                            <select
                                className="second-version-select"
                                value={secondVersion?.id}
                                onChange={handleSecondVersionChange}
                                style={{ marginLeft: '8px' }}
                            >
                                {versions.map(v => (
                                    <option key={v.id} value={v.id}>{v.abbreviation}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>

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
                                    <button className="back-btn" onClick={handleBack}>‹</button>
                                )}
                                <h2>
                                    {selectionStage === 'books' && "Select Book"}
                                    {selectionStage === 'chapters' && `${getLocalizedBookName(tempSelectedBook?.name_full, currentVersion?.id)} `}
                                    {selectionStage === 'verses' && `${getLocalizedBookName(tempSelectedBook?.name_full, currentVersion?.id)} ${tempSelectedChapter} `}
                                </h2>
                            </div>
                            <button className="close-btn" onClick={() => setShowBookSelector(false)}>✕</button>
                        </div>

                        <div className="modal-body">
                            {/* STAGE 1: BOOKS */}
                            {selectionStage === 'books' && books && (
                                <>
                                    <div className="testament-section">
                                        <h3 className="testament-title">Old Testament</h3>
                                        <div className="books-grid">
                                            {books.oldTestament?.map(book => (
                                                <div
                                                    key={book.id}
                                                    className={`book - item ${selectedBook?.id === book.id ? 'active' : ''} `}
                                                    onClick={() => handleBookClick(book)}
                                                >
                                                    {getLocalizedBookName(book.name_full, currentVersion?.id)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="testament-section">
                                        <h3 className="testament-title">New Testament</h3>
                                        <div className="books-grid">
                                            {books.newTestament?.map(book => (
                                                <div
                                                    key={book.id}
                                                    className={`book - item ${selectedBook?.id === book.id ? 'active' : ''} `}
                                                    onClick={() => handleBookClick(book)}
                                                >
                                                    {getLocalizedBookName(book.name_full, currentVersion?.id)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* STAGE 2: CHAPTERS */}
                            {selectionStage === 'chapters' && (
                                <div className="number-grid-container">
                                    <div className="number-grid">
                                        {Array.from({ length: chapterCount }, (_, i) => i + 1).map(num => (
                                            <div
                                                key={num}
                                                className={`number-item ${selectedBook?.id === tempSelectedBook?.id && selectedChapter === num ? 'current' : ''}`}
                                                onClick={() => handleChapterClick(num)}
                                            >
                                                {num}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* STAGE 3: VERSES */}
                            {selectionStage === 'verses' && (
                                <div className="number-grid-container">
                                    <div className="number-grid">
                                        {Array.from({ length: verseCount || 1 }, (_, i) => i + 1).map(num => (
                                            <div
                                                key={num}
                                                className="number-item"
                                                onClick={() => handleVerseClick(num)}
                                            >
                                                {num}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Verses Display */}
            <div className={`verses-container ${isSplitView ? 'split-view' : ''}`}>
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading chapter...</p>
                    </div>
                ) : verses.length > 0 ? (
                    <div className="verses-layout">
                        {/* Integrated Parallel Layout (Sync like one) */}
                        {isSplitView ? (
                            <div
                                className="verses-content integrated-split-view"
                                ref={primaryScrollRef}
                                style={{
                                    fontSize: `${settings.fontSize}px`,
                                    fontFamily: settings.fontFamily === 'serif' ? '"Merriweather", "Times New Roman", serif' : 'system-ui, -apple-system, sans-serif'
                                }}
                            >
                                <div className="integrated-header">
                                    <div className="header-label primary">
                                        <span className="version-badge">{currentVersion?.abbreviation}</span>
                                    </div>
                                    <div className="header-label secondary">
                                        <span className="version-badge">{secondVersion?.abbreviation}</span>
                                        <button
                                            className="summary-btn"
                                            onClick={() => setShowChapterSummary(true)}
                                            title={settings.language === 'af' ? 'Hoofstuk Opsoming' : 'Chapter Summary'}
                                        >
                                            {settings.language === 'af' ? 'Opsoming' : 'Summaries'} 📝
                                        </button>
                                    </div>
                                </div>
                                <div className="integrated-verses-list">
                                    {verses.map((verse) => {
                                        const secondVerse = secondVerses.find(sv => sv.verse === verse.verse);
                                        return (
                                            <div key={verse.id} className="verse-row-integrated">
                                                <div
                                                    className={`verse-box primary ${selectedVerses.some(sv => sv.verse === verse.verse) ? 'verse-selected' : ''}`}
                                                    onClick={(e) => handleVerseTap(verse, e)}
                                                    onContextMenu={(e) => handleLongPress(verse, e)}
                                                    style={{
                                                        backgroundColor: highlights[verse.verse]
                                                            ? HIGHLIGHT_COLORS.find(c => c.color === highlights[verse.verse])?.bg
                                                            : 'transparent'
                                                    }}
                                                >
                                                    <span className="verse-number">{verse.verse}</span>
                                                    <span className="verse-text">{renderVerseText(verse)}</span>
                                                </div>
                                                <div className="verse-box secondary">
                                                    <span className="verse-text">
                                                        {secondVerse ? secondVerse.text : '...'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Standard Single Version Layout */
                            <div
                                className="verses-content primary-column"
                                ref={primaryScrollRef}
                            >
                                <h2 className="chapter-title">
                                    {getLocalizedBookName(verses[0]?.books?.name_full, currentVersion?.id)} {selectedChapter}
                                    <span className="version-badge">{currentVersion?.abbreviation}</span>
                                    <button
                                        className="summary-btn"
                                        onClick={() => setShowChapterSummary(true)}
                                        title={settings.language === 'af' ? 'Hoofstuk Opsoming' : 'Chapter Summary'}
                                    >
                                        {settings.language === 'af' ? 'Opsoming' : 'Summaries'} 📝
                                    </button>
                                </h2>
                                <div
                                    className="verses-list"
                                    style={{
                                        fontSize: `${settings.fontSize}px`,
                                        fontFamily: settings.fontFamily === 'serif' ? '"Merriweather", "Times New Roman", serif' : 'system-ui, -apple-system, sans-serif'
                                    }}
                                >
                                    {verses.map(verse => (
                                        <div
                                            key={verse.id}
                                            id={`verse-${verse.verse}`}
                                            className={`verse-item ${selectedVerses.some(sv => sv.verse === verse.verse) ? 'verse-selected' : ''}`}
                                            onClick={(e) => handleVerseTap(verse, e)}
                                            onContextMenu={(e) => handleLongPress(verse, e)}
                                            style={{
                                                backgroundColor: highlights[verse.verse]
                                                    ? HIGHLIGHT_COLORS.find(c => c.color === highlights[verse.verse])?.bg
                                                    : 'transparent'
                                            }}
                                        >
                                            <span className="verse-number">{verse.verse}</span>
                                            <span className="verse-text">
                                                {renderVerseText(verse)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No verses found for this chapter.</p>
                    </div>
                )}
            </div>

            {/* Reader Mode Navigation Overlay */}
            {isReaderMode && (
                <div className={`reader-overlay ${showReaderControls ? 'show-controls' : ''}`}>
                    <div className="nav-zone edge-left" onClick={handlePrevChapter} title="Previous Chapter">
                        <span className="nav-handle">‹</span>
                    </div>
                    <div className="nav-zone edge-right" onClick={handleNextChapter} title="Next Chapter">
                        <span className="nav-handle">›</span>
                    </div>
                    <div className="nav-zone edge-top" onClick={() => setShowReaderControls(!showReaderControls)} title="Toggle Menu">
                        <span className="top-handle" aria-hidden="true"></span>
                    </div>

                    {showReaderControls && (
                        <>
                            <button className="reader-exit-btn" onClick={() => setIsReaderMode(false)}>
                                <span>🔙 Exit Reader Mode</span>
                            </button>
                            <div className="reader-nav-hint">
                                <span>← Edge to page</span>
                                <span>Center to select</span>
                                <span>Top to toggle menu</span>
                                <span>Edge to page →</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Omni Definition Modal */}
            {showDefinition && (
                <OmniDefinitionModal
                    onClose={() => setShowDefinition(false)}
                />
            )}

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
            {showInfo && (
                <BibleHelpModal
                    onClose={() => setShowInfo(false)}
                    language={settings.language}
                />
            )}

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
                                        onClick={() => window.location.reload()}
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
        </div >
    );
}

export default BibleReader;
