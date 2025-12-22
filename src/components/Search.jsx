import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchVerses, getVerseReference, getBooks } from '../services/bibleService';
import { askBibleQuestion, getUserRemainingQuota } from '../services/aiService';
import { useSettings } from '../context/SettingsContext';
import { getLocalizedBookName } from '../constants/bookNames';
import './Search.css';

// Generate or retrieve user ID from localStorage
function getUserId() {
    let userId = localStorage.getItem('bible_user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('bible_user_id', userId);
    }
    return userId;
}

function Search({ currentVersion, versions }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [searchVersion, setSearchVersion] = useState(searchParams.get('version') || 'all');
    const [searchTestament, setSearchTestament] = useState(searchParams.get('testament') || 'all');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const { settings } = useSettings();

    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // AI Research State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [quotaInfo, setQuotaInfo] = useState({ remaining: 0, quota: 10 });
    const [allBooks, setAllBooks] = useState([]); // For citation lookup
    const [aiHistory, setAiHistory] = useState([]); // AI Q&A history
    const [showAIHistory, setShowAIHistory] = useState(false); // Toggle for history section
    const [showShortcutMenu, setShowShortcutMenu] = useState(false); // Shortcut popup
    const [showMainShortcutMenu, setShowMainShortcutMenu] = useState(false); // Main search shortcut popup
    const [isAnswerExpanded, setIsAnswerExpanded] = useState(false); // Fullscreen answer mode
    const [copyStatus, setCopyStatus] = useState('Copy'); // 'Copy' or 'Copied!'
    const userId = getUserId();

    const AI_SHORTCUTS = [
        { cmd: '/story', desc: 'Tell me the story of...', icon: '📖' },
        { cmd: '/explain', desc: 'Explain from the Bible...', icon: '💡' },
        { cmd: '/meaning', desc: 'Biblical meaning of...', icon: '📚' },
        { cmd: '/who', desc: 'Who was...', icon: '👤' },
        { cmd: '/what', desc: 'What was...', icon: '❓' },
        { cmd: '/why', desc: 'Why did...', icon: '🤔' },
        { cmd: '/teach', desc: 'What does the Bible teach...', icon: '🎓' },
        { cmd: '/compare', desc: 'Compare in the Bible...', icon: '⚖️' },
        { cmd: '/help', desc: 'Show all shortcuts', icon: 'ℹ️' },
    ];

    // Load history and AI state on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('search_history');
        if (savedHistory) setHistory(JSON.parse(savedHistory));

        // Load AI history
        const savedAIHistory = localStorage.getItem('ai_search_history');
        if (savedAIHistory) setAiHistory(JSON.parse(savedAIHistory));
        try {
            const savedAI = sessionStorage.getItem('bible_ai_session');
            if (savedAI) {
                const { question, response, showModal, timestamp } = JSON.parse(savedAI);
                // Valid for 1 hour
                if (Date.now() - timestamp < 3600000) {
                    setAiQuestion(question);
                    setAiResponse(response);
                    setShowAIModal(showModal);
                    if (expanded) setIsAnswerExpanded(expanded); // Restore expanded state
                }
            }
        } catch (e) {
            console.warn("AI session restore failed", e);
        }

        loadQuotaInfo();
        loadBooks();
    }, []);

    // Persist AI State whenever it changes
    useEffect(() => {
        if (aiQuestion || aiResponse || showAIModal) {
            sessionStorage.setItem('bible_ai_session', JSON.stringify({
                question: aiQuestion,
                response: aiResponse,
                showModal: showAIModal,
                expanded: isAnswerExpanded, // Save expanded state
                timestamp: Date.now()
            }));
        }
    }, [aiQuestion, aiResponse, showAIModal, isAnswerExpanded]);

    const loadBooks = async () => {
        const result = await getBooks();
        if (result.success) {
            // Flatten the grouped structure if getBooks returns groups, 
            // or just take the flat list if available. 
            // Checking bibleService: it returns { oldTestament, newTestament, all }
            setAllBooks(result.data.all || []);
        }
    };

    const addToHistory = (query) => {
        const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
        setHistory(newHistory);
        localStorage.setItem('search_history', JSON.stringify(newHistory));
    };
    // Auto-search on mount or param change
    useEffect(() => {
        const query = searchParams.get('q');
        const ver = searchParams.get('version');
        const test = searchParams.get('testament');

        if (query) {
            setSearchQuery(query);
            if (ver) setSearchVersion(ver);
            if (test) setSearchTestament(test);

            // Check session cache first for instant "back" navigation
            try {
                const cached = sessionStorage.getItem('bible_search_cache');
                if (cached) {
                    const { query: cachedQuery, version: cachedVer, testament: cachedTest, data, timestamp } = JSON.parse(cached);
                    // Use cache only if query, version AND testament match
                    const currentVer = ver || 'all';
                    const currentTest = test || 'all';

                    if (cachedQuery === query &&
                        cachedVer === currentVer &&
                        cachedTest === currentTest &&
                        data &&
                        (Date.now() - timestamp < 3600000)) {

                        setResults(data);
                        setHasSearched(true);
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.warn("Cache read error", e);
            }

            performSearch(query, ver || 'all', test || 'all');
        }
    }, [searchParams]);

    const performSearch = async (query, versionId, testament) => {
        if (!query.trim()) return;

        addToHistory(query.trim());
        setLoading(true);
        setHasSearched(true);

        const result = await searchVerses(query.trim(), versionId, testament);

        if (result.success) {
            setResults(result.data);
            // Cache successful results
            try {
                sessionStorage.setItem('bible_search_cache', JSON.stringify({
                    query: query.trim(),
                    version: versionId,
                    testament: testament,
                    data: result.data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn("Cache write error", e);
            }
        } else {
            setResults([]);
        }

        setLoading(false);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        // Update URL
        setSearchParams({ q: searchQuery, version: searchVersion, testament: searchTestament });
        // Search triggered by useEffect on param change OR we can call directly if we want instant
        // But updating params -> useEffect is cleaner for keeping sync
    };

    const highlightText = (text, query) => {
        if (!query) return text;
        const terms = query.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (terms.length === 0) return text;

        // Escape terms for regex and join with |
        const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const parts = text.split(new RegExp(`(${escapedTerms})`, 'gi'));

        return parts.map((part, index) => {
            const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
            return isMatch ?
                <mark key={index} className="highlight">{part}</mark> :
                part;
        });
    };

    const handleFilterChange = (key, value) => {
        // Update local state is not strictly necessary if we depend on URL but keeps UI snappy
        if (key === 'version') setSearchVersion(value);
        if (key === 'testament') setSearchTestament(value);

        // Update URL to trigger search
        const newParams = { q: searchQuery, version: searchVersion, testament: searchTestament };
        newParams[key] = value; // Override with new value
        setSearchParams(newParams);
    };

    const loadQuotaInfo = async () => {
        const info = await getUserRemainingQuota(userId);
        setQuotaInfo(info);
    };

    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem('search_history');
        setShowHistory(false);
    };

    const handleAskAI = () => {
        setAiQuestion(searchQuery);
        setShowAIModal(true);
        setAiResponse(null);
    };

    const submitAIQuestion = async () => {
        if (!aiQuestion.trim()) return;

        setAiLoading(true);
        setAiResponse(null);

        // Process shortcuts like /story, /explain, /meaning
        let processedQuestion = aiQuestion.trim();

        const shortcuts = {
            '/story': 'Tell me the complete biblical story of',
            '/explain': 'Explain in detail from the Bible about',
            '/meaning': 'What is the biblical meaning of',
            '/verse': 'What does the Bible say in',
            '/who': 'Who was',
            '/what': 'What was',
            '/why': 'Why did',
            '/compare': 'Compare and contrast in the Bible:',
            '/teach': 'What does the Bible teach about'
        };

        // Handle /help command - show shortcuts without calling AI
        if (processedQuestion.toLowerCase() === '/help' || processedQuestion.toLowerCase() === '/help ') {
            setAiLoading(false);
            setAiResponse(`📚 **AI Shortcut Commands**

Here are the available shortcuts to quickly ask questions:

• **/story [topic]** - Tell me the complete biblical story of...
  Example: \`/story Moses\` or \`/story David and Goliath\`

• **/explain [topic]** - Explain in detail from the Bible about...
  Example: \`/explain salvation\`

• **/meaning [word]** - What is the biblical meaning of...
  Example: \`/meaning grace\`

• **/who [person]** - Who was...
  Example: \`/who Abraham\`

• **/what [thing]** - What was...
  Example: \`/what the Passover\`

• **/why [topic]** - Why did...
  Example: \`/why Adam sin\`

• **/teach [topic]** - What does the Bible teach about...
  Example: \`/teach forgiveness\`

• **/compare [topics]** - Compare and contrast in the Bible...
  Example: \`/compare law and grace\`

• **/verse [reference]** - What does the Bible say in...
  Example: \`/verse John 3:16\`

💡 **Tip:** Just type the shortcut followed by your topic and press Ask!`);
            return;
        }

        for (const [shortcut, expansion] of Object.entries(shortcuts)) {
            if (processedQuestion.toLowerCase().startsWith(shortcut + ' ')) {
                const topic = processedQuestion.substring(shortcut.length + 1).trim();
                processedQuestion = `${expansion} ${topic}`;
                break;
            }
        }

        let contextSource = results;

        // If no results on screen, perform background search for context
        if (results.length === 0) {
            try {
                // Use the question itself as a search query to find relevant verses
                // Remove common question words to improve search
                const cleanQuery = aiQuestion
                    .replace(/^(what|who|where|when|why|how|does|is|are|can|will|should) /i, '')
                    .replace(/\?$/, '')
                    .trim();

                // If query is too short after cleaning, use original
                const searchQuery = cleanQuery.length > 3 ? cleanQuery : aiQuestion;

                const searchResult = await searchVerses(searchQuery, 'all', 'all');
                if (searchResult.success && searchResult.data.length > 0) {
                    contextSource = searchResult.data;
                }
            } catch (err) {
                console.error("Background search failed", err);
            }
        }

        // Use search results as verse context (limit to top 15 for better context)
        const verseContext = contextSource.slice(0, 15).map(v => ({
            book: v.books.name_full,
            chapter: v.chapter,
            verse: v.verse,
            text: v.text
        }));

        const result = await askBibleQuestion(userId, processedQuestion, verseContext);

        setAiLoading(false);

        if (result.success) {
            setAiResponse(result.answer);

            // Save to AI history
            const newEntry = {
                question: aiQuestion,
                answer: result.answer,
                timestamp: Date.now()
            };
            const updatedHistory = [newEntry, ...aiHistory].slice(0, 20); // Keep last 20
            setAiHistory(updatedHistory);
            localStorage.setItem('ai_search_history', JSON.stringify(updatedHistory));

            // Refresh quota
            await loadQuotaInfo();
        } else {
            setAiResponse(`❌ ${result.error}`);
        }
    };

    const copyToClipboard = () => {
        if (!aiResponse) return;

        // Clean text: Remove [[ and ]] delimiters
        const cleanText = aiResponse.replace(/\[\[/g, '').replace(/\]\]/g, '');

        navigator.clipboard.writeText(cleanText).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus('Copy'), 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    };



    const handleCitationClick = (citation) => {
        // citation format: "Book Chapter:Verse" e.g., "John 3:16" or "1 Samuel 17:4"
        try {
            // Strategy: Look for the last space which separates Book and Chapter:Verse
            const lastSpaceIndex = citation.lastIndexOf(' ');
            if (lastSpaceIndex === -1) return;

            const bookNameRaw = citation.substring(0, lastSpaceIndex).trim();
            const refPart = citation.substring(lastSpaceIndex + 1).trim(); // "3:16"

            const [chapter, verse] = refPart.split(':');

            // Normalization helper - handles common variations
            const normalizeBookName = (name) => {
                let normalized = name.toLowerCase().trim()
                    // Handle numbered books
                    .replace(/^first /, '1 ')
                    .replace(/^second /, '2 ')
                    .replace(/^third /, '3 ')
                    .replace(/^i /, '1 ')
                    .replace(/^ii /, '2 ')
                    .replace(/^iii /, '3 ')
                    .replace(/^1st /, '1 ')
                    .replace(/^2nd /, '2 ')
                    .replace(/^3rd /, '3 ')
                    // Handle singular/plural variations
                    .replace(/^psalm$/, 'psalms')
                    .replace(/^proverb$/, 'proverbs')
                    .replace(/^song of solomon$/, 'song of songs')
                    .replace(/^songs of solomon$/, 'song of songs')
                    .replace(/^revelation$/, 'revelations')
                    // Remove dots and extra spaces
                    .replace(/\./g, '')
                    .replace(/\s+/g, ' ');

                return normalized;
            };

            const targetName = normalizeBookName(bookNameRaw);

            // Try exact match first
            let book = allBooks.find(b => {
                const dbName = normalizeBookName(b.name_full);
                return dbName === targetName || b.id === bookNameRaw.toUpperCase();
            });

            // Fallback: try partial match (for cases like "Psalm" matching "Psalms")
            if (!book) {
                book = allBooks.find(b => {
                    const dbName = normalizeBookName(b.name_full);
                    return dbName.startsWith(targetName) || targetName.startsWith(dbName);
                });
            }

            if (book) {
                // Navigate to bible reader
                navigate('/bible', {
                    state: {
                        bookId: book.id,
                        chapter: parseInt(chapter),
                        targetVerse: parseInt(verse),
                        fromSearch: true
                    }
                });
                // Persist state, don't close modal (handled by caching)
            } else {
                console.warn(`Book not found: ${bookNameRaw} (Normalized: ${targetName})`);
                // Optional: Flash a toast or error to user
            }
        } catch (e) {
            console.error("Error parsing citation", e);
        }
    };

    // Parse AI text to replace [[Book Chapter:Verse]] with links
    // Handles multiple verses like [[2 Samuel 8:10, 8:8]]
    const formatAIResponse = (text) => {
        if (!text) return null;

        // Regex for [[Book Chapter:Verse]] or [[Book Chapter:Verse, Chapter:Verse, ...]]
        const parts = text.split(/(\[\[.*?\]\])/g);

        return parts.map((part, index) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const content = part.slice(2, -2); // Remove [[ and ]]

                // Check if it contains multiple verses (comma-separated)
                if (content.includes(',')) {
                    // Split by comma: "2 Samuel 8:10, 8:8" -> ["2 Samuel 8:10", "8:8"]
                    const refs = content.split(',').map(r => r.trim());

                    // Extract book name from the first reference
                    const firstRef = refs[0];
                    const lastSpaceIdx = firstRef.lastIndexOf(' ');
                    const bookPart = lastSpaceIdx !== -1 ? firstRef.substring(0, lastSpaceIdx) : '';

                    return refs.map((ref, refIdx) => {
                        // If ref doesn't have a book name (e.g. "8:8"), prepend the book
                        let fullRef = ref;
                        if (!ref.includes(' ') && bookPart) {
                            // This is just "8:8" (chapter:verse only), add the book
                            fullRef = `${bookPart} ${ref}`;
                        }

                        return (
                            <button
                                key={`${index}-${refIdx}`}
                                className="citation-link"
                                onClick={() => handleCitationClick(fullRef)}
                                title="Read this verse"
                            >
                                📖 {fullRef}
                            </button>
                        );
                    });
                }

                // Single verse - original behavior
                return (
                    <button
                        key={index}
                        className="citation-link"
                        onClick={() => handleCitationClick(content)}
                        title="Read this verse"
                    >
                        📖 {content}
                    </button>
                );
            }
            return part; // Return normal text
        });
    };

    return (
        <div className="search-page">
            <div className="search-header">
                <h1 className="search-title">Search the Bible</h1>

                <div className="search-input-container">
                    <form onSubmit={handleSearch} className="search-form">
                        {/* Row 1: Input + History Toggle */}
                        <div className="search-bar-row">
                            <input
                                type="text"
                                className="search-input input"
                                placeholder="Search for verses..."
                                value={searchQuery}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchQuery(val);
                                    // Show menu if starting with / and no space yet (typing command)
                                    if (val.startsWith('/') && !val.includes(' ')) {
                                        setShowMainShortcutMenu(true);
                                        setShowHistory(false);
                                    } else {
                                        setShowMainShortcutMenu(false);
                                    }
                                }}
                                onClick={() => {
                                    if (searchQuery.startsWith('/') && !searchQuery.includes(' ')) {
                                        setShowMainShortcutMenu(true);
                                    } else {
                                        setShowHistory(true);
                                    }
                                }}
                            />

                            {/* Main Search Shortcut Menu */}
                            {showMainShortcutMenu && (
                                <div className="shortcut-popup main-search-shortcuts" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1000,
                                    marginTop: '5px'
                                }}>
                                    <div className="shortcut-header">⚡ Quick AI Research</div>
                                    {AI_SHORTCUTS.map((item) => (
                                        <button
                                            key={item.cmd}
                                            className="shortcut-item"
                                            onClick={() => {
                                                setAiQuestion(item.cmd + ' ');
                                                setSearchQuery(''); // Clear main search
                                                setShowMainShortcutMenu(false);
                                                setShowAIModal(true); // Open AI modal
                                            }}
                                            type="button"
                                        >
                                            <span className="shortcut-icon">{item.icon}</span>
                                            <span className="shortcut-cmd">{item.cmd}</span>
                                            <span className="shortcut-desc">{item.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                className={`history-toggle-btn ${showHistory ? 'active' : ''}`}
                                onClick={toggleHistory}
                                title="Search History"
                            >
                                🕒
                            </button>
                        </div>

                        {/* Row 2: Action Buttons */}
                        <div className="search-actions-row">
                            <button
                                type="submit"
                                className="search-btn btn-primary"
                                onClick={(e) => {
                                    // If user typed a command manually in main search, handle it as AI
                                    if (searchQuery.startsWith('/')) {
                                        e.preventDefault();
                                        setAiQuestion(searchQuery);
                                        setSearchQuery('');
                                        setShowAIModal(true);
                                    }
                                }}
                                disabled={loading || !searchQuery.trim()}
                            >
                                {loading ? '...' : (searchQuery.startsWith('/') ? '🤖 Ask AI' : '🔍 Search')}
                            </button>
                            <button
                                type="button"
                                className="search-btn ai-btn"
                                onClick={handleAskAI}
                                disabled={quotaInfo.remaining <= 0}
                            >
                                🤖 AI Research
                            </button>
                        </div>
                    </form>

                    {/* History Dropdown */}
                    {showHistory && history.length > 0 && (
                        <div className="history-dropdown">
                            <div className="history-header">
                                <span>Recent Searches</span>
                                <button className="clear-history-btn" onClick={clearHistory}>Clear</button>
                            </div>
                            <div className="history-list">
                                {history.map((term, i) => (
                                    <button
                                        key={i}
                                        className="history-item"
                                        onClick={() => {
                                            setSearchQuery(term);
                                            setSearchParams({ q: term, version: searchVersion, testament: searchTestament });
                                            setShowHistory(false);
                                        }}
                                    >
                                        🕒 {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="search-filters">
                    {/* ... filters ... */}
                    <label className="filter-label">
                        <span>Version:</span>
                        <select
                            className="version-filter select"
                            value={searchVersion}
                            onChange={(e) => handleFilterChange('version', e.target.value)}
                        >
                            <option value="all">All Versions</option>
                            {versions.map(version => (
                                <option key={version.id} value={version.id}>
                                    {version.abbreviation} - {version.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="filter-label">
                        <span>Testament:</span>
                        <select
                            className="version-filter select"
                            value={searchTestament}
                            onChange={(e) => handleFilterChange('testament', e.target.value)}
                        >
                            <option value="all">Both Testaments</option>
                            <option value="OT">Old Testament</option>
                            <option value="NT">New Testament</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="search-results">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Searching...</p>
                    </div>
                ) : hasSearched ? (
                    results.length > 0 ? (
                        <>
                            <div className="results-header">
                                <p className="results-count">
                                    Found {results.length} verse{results.length !== 1 ? 's' : ''}
                                </p>
                                <button
                                    className="ai-research-btn btn-primary"
                                    onClick={handleAskAI}
                                    disabled={quotaInfo.remaining <= 0}
                                >
                                    🤖 Ask AI ({quotaInfo.remaining} left)
                                </button>
                            </div>

                            <div
                                className="results-list"
                                style={{
                                    fontSize: `${settings.fontSize}px`,
                                    fontFamily: settings.fontFamily === 'serif' ? '"Merriweather", "Times New Roman", serif' : 'system-ui, -apple-system, sans-serif'
                                }}
                            >
                                {results.map((verse, index) => (
                                    <div key={index} className="verse-card" onClick={() => {
                                        navigate('/bible', {
                                            state: {
                                                bookId: verse.books.id,
                                                chapter: verse.chapter,
                                                targetVerse: verse.verse,
                                                fromSearch: true
                                            }
                                        });
                                    }}>
                                        <div className="result-header">
                                            <span className="result-ref">
                                                {getLocalizedBookName(verse.books.name_full, verse.version === 'AFR53' || verse.version === 'AFR83' ? 'af' : settings.language)} {verse.chapter}:{verse.verse}
                                            </span>
                                            <span className="result-version">
                                                {verse.version}
                                            </span>
                                        </div>
                                        <p className="result-text">
                                            {highlightText(verse.text, searchQuery)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {results.length >= 1000 && (
                                <p className="results-notice">
                                    Showing first 1000 results. Try a more specific search if you can't find what you're looking for.
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">📖</div>
                            <h3>No verses found</h3>
                            <p>Try different keywords or check your spelling</p>
                        </div>
                    )
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <h3>Search the Scriptures</h3>
                        <p>Enter keywords, phrases, or topics to find verses</p>
                        <div className="search-tips">
                            {history.length > 0 && (
                                <div className="search-history">
                                    <h4>Recent Searches</h4>
                                    <div className="history-chips">
                                        {history.map((term, i) => (
                                            <button
                                                key={i}
                                                className="history-chip"
                                                onClick={() => {
                                                    setSearchQuery(term);
                                                    setSearchParams({ q: term, version: searchVersion, testament: searchTestament });
                                                }}
                                            >
                                                🕒 {term}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <h4>Search Tips:</h4>
                            <ul>
                                <li>Try single words like "love" or "faith"</li>
                                <li>Use phrases like "the Lord is my shepherd"</li>
                                <li>Search for specific topics like "forgiveness"</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Research Modal */}
            {showAIModal && (
                <div className="book-selector-modal ai-research-modal" onClick={() => setShowAIModal(false)}>
                    <div className="book-selector-content info-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🤖 AI Bible Research</h2>
                            <button className="close-btn back-to-results" onClick={() => setShowAIModal(false)}>
                                ⬅ Back to Results
                            </button>
                        </div>
                        <div className="modal-body info-body">
                            {!isAnswerExpanded && (
                                <div className="info-section">
                                    <h3>Ask your question:</h3>
                                    <textarea
                                        className="ai-question-input"
                                        placeholder="e.g., What does the Bible say about faith? How should Christians respond to suffering?"
                                        value={aiQuestion}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAiQuestion(val);
                                            // Show shortcut menu only if typing command (starts with / and no space yet)
                                            if (val.startsWith('/') && !val.includes(' ')) {
                                                setShowShortcutMenu(true);
                                            } else {
                                                setShowShortcutMenu(false);
                                            }
                                        }}
                                        rows={3}
                                    />

                                    {/* Shortcut popup menu */}
                                    {showShortcutMenu && (
                                        <div className="shortcut-popup">
                                            <div className="shortcut-header">⚡ Quick Commands</div>
                                            {AI_SHORTCUTS.map((item) => (
                                                <button
                                                    key={item.cmd}
                                                    className="shortcut-item"
                                                    onClick={() => {
                                                        setAiQuestion(item.cmd + ' ');
                                                        setShowShortcutMenu(false);
                                                    }}
                                                >
                                                    <span className="shortcut-icon">{item.icon}</span>
                                                    <span className="shortcut-cmd">{item.cmd}</span>
                                                    <span className="shortcut-desc">{item.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        className="ai-submit-btn"
                                        onClick={() => {
                                            setShowShortcutMenu(false);
                                            submitAIQuestion();
                                        }}
                                        disabled={aiLoading || !aiQuestion.trim()}
                                    >
                                        {aiLoading ? '⏳ AI is thinking...' : '💬 Submit Question'}
                                    </button>
                                </div>
                            )}

                            {aiResponse && (
                                <div
                                    className={`info-section ai-response ${isAnswerExpanded ? 'expanded' : ''}`}
                                    onDoubleClick={() => setIsAnswerExpanded(!isAnswerExpanded)}
                                >
                                    <div className="ai-response-header">
                                        <h3>📚 Biblical Answer:</h3>
                                        <div className="ai-response-actions">
                                            <button
                                                className={`copy-btn ${copyStatus === 'Copied!' ? 'success' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyToClipboard();
                                                }}
                                                title="Copy to clipboard"
                                            >
                                                {copyStatus === 'Copied!' ? '✅ ' : '📋 '}{copyStatus}
                                            </button>
                                            {!isAnswerExpanded && (
                                                <button
                                                    className="expand-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsAnswerExpanded(true);
                                                    }}
                                                >
                                                    ⤢ Expand
                                                </button>
                                            )}
                                            {isAnswerExpanded && (
                                                <button
                                                    className="collapse-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsAnswerExpanded(false);
                                                    }}
                                                >
                                                    ✕ Close
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ai-answer">
                                        {formatAIResponse(aiResponse)}
                                    </div>
                                    {isAnswerExpanded && (
                                        <div className="expanded-nav-buttons">
                                            <button onClick={() => navigate('/bible')}>📖 Bible</button>
                                            <button onClick={() => { setIsAnswerExpanded(false); setShowAIModal(false); }}>🔍 Search</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isAnswerExpanded && (
                                <div className="info-footer">
                                    <p>📈 {quotaInfo.remaining} questions remaining today (based on {quotaInfo.quota} daily limit)</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '5px' }}>AI responses are based on search results and biblical text.</p>
                                </div>
                            )}

                            {/* AI History Section */}
                            {aiHistory.length > 0 && (
                                <div className="ai-history-section">
                                    <button
                                        className="ai-history-toggle"
                                        onClick={() => setShowAIHistory(!showAIHistory)}
                                    >
                                        📜 Previous Questions ({aiHistory.length})
                                        <span className={`toggle-arrow ${showAIHistory ? 'open' : ''}`}>▼</span>
                                    </button>

                                    {showAIHistory && (
                                        <div className="ai-history-list">
                                            {aiHistory.map((item, idx) => (
                                                <div key={idx} className="ai-history-item">
                                                    <div className="ai-history-question">
                                                        <span className="question-text">❓ {item.question}</span>
                                                        <button
                                                            className="reask-btn"
                                                            onClick={() => {
                                                                setAiQuestion(item.question);
                                                                setAiResponse(item.answer); // Show the saved answer
                                                            }}
                                                            title="View this answer"
                                                        >
                                                            View
                                                        </button>
                                                    </div>
                                                    <div className="ai-history-date">
                                                        {new Date(item.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                className="clear-ai-history-btn"
                                                onClick={() => {
                                                    setAiHistory([]);
                                                    localStorage.removeItem('ai_search_history');
                                                }}
                                            >
                                                🗑️ Clear History
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Search;
