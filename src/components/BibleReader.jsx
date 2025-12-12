
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBooks, getChapter, getChapterCount, getVerseCount } from '../services/bibleService';
import { getLocalizedBookName } from '../constants/bookNames';
import './BibleReader.css';

function BibleReader({ currentVersion, setCurrentVersion, versions }) {
    const navigate = useNavigate();
    const [books, setBooks] = useState({ oldTestament: [], newTestament: [] });
    const [selectedBook, setSelectedBook] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(1);
    const [chapterCount, setChapterCount] = useState(1);
    const [verseCount, setVerseCount] = useState(0); // For verse selection grid
    const [verses, setVerses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showBookSelector, setShowBookSelector] = useState(false);

    // Navigation State
    const [selectionStage, setSelectionStage] = useState('books'); // 'books', 'chapters', 'verses'
    const [tempSelectedBook, setTempSelectedBook] = useState(null);
    const [tempSelectedChapter, setTempSelectedChapter] = useState(1);
    const [targetVerse, setTargetVerse] = useState(null); // For scrolling to verse

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, text: '', step: 'initial' });

    useEffect(() => {
        loadBooks();
    }, []);

    useEffect(() => {
        if (selectedBook && currentVersion) {
            loadChapterCount();
            loadChapter();
        }
    }, [selectedBook, selectedChapter, currentVersion]);


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
                    <h1 className="app-title">Bible Study</h1>
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
                        >
                            {verses.map(verse => (
                                <div key={verse.id} id={`verse-${verse.verse}`} className="verse-item">
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
        </div>
    );
}

export default BibleReader;
