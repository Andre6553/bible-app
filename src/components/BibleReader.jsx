import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getBooks, getChapter, getChapterCount, getVerseCount } from '../services/bibleService';
import { getChapterHighlights, saveHighlight, removeHighlight, getVerseNote, saveNote, HIGHLIGHT_COLORS } from '../services/highlightService';
import { getLocalizedBookName } from '../constants/bookNames';
import { useSettings } from '../context/SettingsContext';
import VerseActionSheet from './VerseActionSheet';
import NoteModal from './NoteModal';
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

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, text: '', step: 'initial' });

    // Highlight State
    const [highlights, setHighlights] = useState({}); // { verseNum: color }
    const [selectedVerse, setSelectedVerse] = useState(null); // Currently tapped verse
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [existingNote, setExistingNote] = useState(null);

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
    }, [selectedBook, selectedChapter, currentVersion]);

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
                version: currentVersion.id
            }));
        }
    }, [selectedBook, selectedChapter, currentVersion]);

    const loadHighlights = async () => {
        if (!selectedBook || !currentVersion) return;
        const result = await getChapterHighlights(selectedBook.id, selectedChapter, currentVersion.id);
        if (result.success) {
            setHighlights(result.highlights);
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
                    const { bookId, chapter, version } = JSON.parse(lastPosition);
                    const book = result.data.all.find(b => b.id == bookId);
                    if (book) {
                        console.log('📚 Restoring last reading position:', book.name_full, chapter);
                        setSelectedBook(book);
                        setSelectedChapter(chapter || 1);
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
        const result = await getChapter(selectedBook.id, selectedChapter, currentVersion.id);
        if (result.success) {
            setVerses(result.data || []);
        }
        setLoading(false);
    };

    // Verse tap handler - single tap to select
    const handleVerseTap = (verse, e) => {
        // Don't trigger for text selection (long press/drag)
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        e.stopPropagation();
        setSelectedVerse(verse);
        setShowActionSheet(true);
    };

    // Handle highlight color selection
    const handleHighlight = async (color) => {
        if (!selectedVerse || !selectedBook || !currentVersion) return;

        if (color === null) {
            // Remove highlight
            await removeHighlight(selectedBook.id, selectedChapter, selectedVerse.verse, currentVersion.id);
            setHighlights(prev => {
                const updated = { ...prev };
                delete updated[selectedVerse.verse];
                return updated;
            });
        } else {
            // Add/update highlight
            await saveHighlight(selectedBook.id, selectedChapter, selectedVerse.verse, currentVersion.id, color);
            setHighlights(prev => ({
                ...prev,
                [selectedVerse.verse]: color
            }));
        }
        setShowActionSheet(false);
        setSelectedVerse(null);
    };

    // Handle opening note modal
    const handleOpenNote = async () => {
        if (!selectedVerse || !selectedBook || !currentVersion) return;

        // Check for existing note
        const result = await getVerseNote(selectedBook.id, selectedChapter, selectedVerse.verse, currentVersion.id);
        setExistingNote(result.note);
        setShowActionSheet(false);
        setShowNoteModal(true);
    };

    // Handle saving note
    const handleSaveNote = async (noteText, studyId, labelIds) => {
        if (!selectedVerse || !selectedBook || !currentVersion) return;

        await saveNote(selectedBook.id, selectedChapter, selectedVerse.verse, currentVersion.id, noteText, studyId, labelIds);
        setShowNoteModal(false);
        setSelectedVerse(null);
        setExistingNote(null);
    };

    // Close action sheet
    const handleCloseActionSheet = () => {
        setShowActionSheet(false);
        setSelectedVerse(null);
    };

    // Get verse reference string
    const getVerseRef = (verse) => {
        const bookName = getLocalizedBookName(selectedBook?.name_full, currentVersion?.id);
        return `${bookName} ${selectedChapter}:${verse.verse}`;
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

    return (
        <div className="bible-reader">
            {/* Header */}
            <div className="bible-header">
                <div className="header-top">
                    <div className="header-left">
                        <button className="info-btn icon-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
                        <button className="info-btn icon-btn" onClick={() => setShowInfo(true)} title="App Info">ℹ️</button>
                        <h1 className="app-title">Bible Study</h1>
                    </div>
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

                <div className="reading-controls">
                    {location.state?.fromSearch && (
                        <button
                            className="book-selector-btn btn-secondary"
                            onClick={() => navigate('/search' + location.search)} // Maintain params if needed, or just /search
                            style={{ marginRight: '8px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}
                        >
                            ⬅ Back
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
                        <span className="chapter-display">
                            {['AFR53', 'AFR83'].includes(currentVersion?.id) ? 'Hoofstuk' : 'Chapter'} {selectedChapter}
                        </span>
                        <button
                            className="chapter-btn btn-secondary"
                            onClick={handleNextChapter}
                            disabled={selectedChapter >= chapterCount}
                        >
                            ›
                        </button>
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
                                    {selectionStage === 'chapters' && `${getLocalizedBookName(tempSelectedBook?.name_full, currentVersion?.id)}`}
                                    {selectionStage === 'verses' && `${getLocalizedBookName(tempSelectedBook?.name_full, currentVersion?.id)} ${tempSelectedChapter}`}
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
                                                    className={`book-item ${selectedBook?.id === book.id ? 'active' : ''}`}
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
                                                    className={`book-item ${selectedBook?.id === book.id ? 'active' : ''}`}
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
            <div className="verses-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading chapter...</p>
                    </div>
                ) : verses.length > 0 ? (
                    <div className="verses-content">
                        <h2 className="chapter-title">
                            {getLocalizedBookName(verses[0]?.books?.name_full, currentVersion?.id)} {selectedChapter}
                            <span className="version-badge">{currentVersion?.abbreviation}</span>
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
                                    className={`verse-item ${selectedVerse?.verse === verse.verse ? 'verse-selected' : ''}`}
                                    onClick={(e) => handleVerseTap(verse, e)}
                                    style={{
                                        backgroundColor: highlights[verse.verse]
                                            ? HIGHLIGHT_COLORS.find(c => c.color === highlights[verse.verse])?.bg
                                            : 'transparent'
                                    }}
                                >
                                    <span className="verse-number">{verse.verse}</span>
                                    <span className="verse-text">{verse.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No verses found for this chapter.</p>
                    </div>
                )}
            </div>

            {/* Info / Help Modal */}
            {showInfo && (
                <div className="book-selector-modal" onClick={() => setShowInfo(false)}>
                    <div className="book-selector-content info-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>How to use this App</h2>
                            <button className="close-btn" onClick={() => setShowInfo(false)}>✕</button>
                        </div>
                        <div className="modal-body info-body">
                            <div className="info-section">
                                <h3>📖 Reading the Bible</h3>
                                <p>Tap the <strong>Book Name</strong> button to browse books, chapters, and verses. Use the <strong>&lt; / &gt;</strong> arrows to navigate between chapters.</p>
                            </div>

                            <div className="info-section">
                                <h3>🔍 Search</h3>
                                <p>Go to the <strong>Search</strong> tab to find verses by keyword. You can filter by Bible version and Testament (Old/New).</p>
                            </div>

                            <div className="info-section">
                                <h3>🤖 AI Research</h3>
                                <p>Ask any Bible question! Click <strong>"AI Research"</strong> in Search to get AI-powered answers with scripture references. Click the references to jump directly to those verses.</p>
                            </div>

                            <div className="info-section">
                                <h3>⚡ AI Shortcuts</h3>
                                <p>Use quick commands in AI Research for faster questions:</p>
                                <p style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                                    <strong>/story</strong> - Tell me the story of...<br />
                                    <strong>/explain</strong> - Explain...<br />
                                    <strong>/meaning</strong> - What is the biblical meaning of...<br />
                                    <strong>/who</strong> - Who was...<br />
                                    <strong>/what</strong> - What was...<br />
                                    <strong>/why</strong> - Why did...<br />
                                    <strong>/teach</strong> - What does the Bible teach...<br />
                                    <strong>/compare</strong> - Compare in the Bible...<br />
                                    <strong>/help</strong> - Show all shortcuts
                                </p>
                            </div>

                            <div className="info-section">
                                <h3>✨ For You (Blog)</h3>
                                <p>Discover personalized content! Get a <strong>daily devotional</strong> based on your interests, browse <strong>trending topics</strong>, and read <strong>recommended articles</strong> tailored to your search history.</p>
                            </div>

                            <div className="info-section">
                                <h3>📝 Quick Search</h3>
                                <p><strong>Select any word</strong> in the Bible text, then choose to search for it in the Old or New Testament.</p>
                            </div>

                            <div className="info-section">
                                <h3>🌍 Bible Versions</h3>
                                <p>Switch between <strong>KJV</strong> (English) and <strong>AFR53</strong> (Afrikaans) using the dropdown at the top.</p>
                            </div>

                            <div className="info-section">
                                <h3>⚙️ Settings</h3>
                                <p>Customize your reading experience! Adjust <strong>font size</strong>, choose between <strong>modern or classic fonts</strong>, and personalize your <strong>theme color</strong>.</p>
                            </div>

                            <div className="info-section">
                                <h3>⚡ Offline Use</h3>
                                <p>This app works offline! Chapters you've read are saved automatically for reading without internet.</p>
                            </div>

                            <div className="info-footer">
                                <p>Version 3.0.0</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="book-selector-modal" onClick={() => setShowSettings(false)}>
                    <div className="book-selector-content info-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Reader Settings ⚙️</h2>
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
            )}

            {/* Verse Action Sheet */}
            {showActionSheet && selectedVerse && (
                <VerseActionSheet
                    verse={selectedVerse}
                    verseText={selectedVerse.text}
                    verseRef={getVerseRef(selectedVerse)}
                    currentColor={highlights[selectedVerse.verse]}
                    onHighlight={handleHighlight}
                    onNote={handleOpenNote}
                    onCopy={() => { }}
                    onClose={handleCloseActionSheet}
                />
            )}

            {/* Note Modal */}
            {showNoteModal && selectedVerse && (
                <NoteModal
                    verse={selectedVerse}
                    verseText={selectedVerse.text}
                    verseRef={getVerseRef(selectedVerse)}
                    existingNote={existingNote}
                    onSave={handleSaveNote}
                    onClose={() => {
                        setShowNoteModal(false);
                        setSelectedVerse(null);
                        setExistingNote(null);
                    }}
                />
            )}
        </div>
    );
}

export default BibleReader;
