import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchVerses, getVerseReference, getBooks } from '../services/bibleService';
import { askBibleQuestion, getUserRemainingQuota } from '../services/aiService';
import { useSettings } from '../context/SettingsContext';
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

    // AI Research State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [quotaInfo, setQuotaInfo] = useState({ remaining: 0, quota: 10 });
    const [allBooks, setAllBooks] = useState([]); // For citation lookup
    const userId = getUserId();

    // Load history on mount
    useEffect(() => {
        const saved = localStorage.getItem('search_history');
        if (saved) setHistory(JSON.parse(saved));

        // Load quota info
        // Load quota info
        loadQuotaInfo();

        // Load books for citation lookup
        loadBooks();
    }, []);

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
    // Auto-search on mount if params exist
    useEffect(() => {
        const query = searchParams.get('q');
        const ver = searchParams.get('version');
        const test = searchParams.get('testament');

        if (query) {
            setSearchQuery(query);
            if (ver) setSearchVersion(ver);
            if (test) setSearchTestament(test);
            performSearch(query, ver || 'all', test || 'all');
        }
    }, [searchParams]);

    const performSearch = async (query, versionId, testament) => {
        if (!query.trim()) return;

        addToHistory(query.trim()); // Save to history
        setLoading(true);
        setHasSearched(true);

        const result = await searchVerses(query.trim(), versionId, testament);

        if (result.success) {
            setResults(result.data);
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

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === query.toLowerCase() ?
                <mark key={index} className="highlight">{part}</mark> :
                part
        );
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

    const handleAskAI = () => {
        setAiQuestion(searchQuery);
        setShowAIModal(true);
        setAiResponse(null);
    };

    const submitAIQuestion = async () => {
        if (!aiQuestion.trim()) return;

        setAiLoading(true);
        setAiResponse(null);

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

        const result = await askBibleQuestion(userId, aiQuestion, verseContext);

        setAiLoading(false);

        if (result.success) {
            setAiResponse(result.answer);
            // Refresh quota
            await loadQuotaInfo();
        } else {
            setAiResponse(`❌ ${result.error}`);
        }
    };



    const handleCitationClick = (citation) => {
        // citation format: "Book Chapter:Verse" e.g., "John 3:16" or "1 Samuel 17:4"
        try {
            // Strategy: Look for the last space which separates Book and Chapter:Verse
            const lastSpaceIndex = citation.lastIndexOf(' ');
            if (lastSpaceIndex === -1) return;

            const bookName = citation.substring(0, lastSpaceIndex).trim();
            const refPart = citation.substring(lastSpaceIndex + 1).trim(); // "3:16"

            const [chapter, verse] = refPart.split(':');

            // Find book ID
            // Handle cases where AI says "First John" vs "1 John" if needed, 
            // but for now relying on AI to match our naming or us to match standard.
            // Our DB uses "1 John", "Genesis", etc.
            const book = allBooks.find(b =>
                b.name_full.toLowerCase() === bookName.toLowerCase() ||
                b.id === bookName.toUpperCase()
            );

            if (book) {
                // Navigate to bible reader
                navigate('/bible', {
                    state: {
                        bookId: book.id,
                        chapter: parseInt(chapter),
                        targetVerse: parseInt(verse)
                    }
                });
                setShowAIModal(false); // Close modal to see bible
            } else {
                console.warn(`Book not found: ${bookName}`);
            }
        } catch (e) {
            console.error("Error parsing citation", e);
        }
    };

    // Parse AI text to replace [[Book Chapter:Verse]] with links
    const formatAIResponse = (text) => {
        if (!text) return null;

        // Regex for [[Book Chapter:Verse]]
        const parts = text.split(/(\[\[.*?\]\])/g);

        return parts.map((part, index) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const content = part.slice(2, -2); // Remove [[ and ]]
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
            const [showHistory, setShowHistory] = useState(false);

    // ... (existing code)

    const toggleHistory = () => {
                setShowHistory(!showHistory);
    };

    const clearHistory = () => {
                setHistory([]);
            localStorage.removeItem('search_history');
            setShowHistory(false);
    };

            return (
            <div className="search-page">
                <div className="search-header">
                    <h1 className="search-title">Search the Bible</h1>

                    <div className="search-input-container">
                        <form onSubmit={handleSearch} className="search-form">
                            <div className="search-input-wrapper">
                                <input
                                    type="text"
                                    className="search-input input"
                                    placeholder="Search for verses..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClick={() => setShowHistory(true)} // Open history on click
                                />
                                {/* History Toggle Button */}
                                <button
                                    type="button"
                                    className={`history-toggle-btn ${showHistory ? 'active' : ''}`}
                                    onClick={toggleHistory}
                                    title="Search History"
                                >
                                    🕒
                                </button>

                                <button
                                    type="submit"
                                    className="search-btn btn-primary"
                                    disabled={loading || !searchQuery.trim()}
                                >
                                    {loading ? '...' : '🔍'}
                                </button>
                                <button
                                    type="button"
                                    className="search-btn ai-btn"
                                    onClick={handleAskAI}
                                    disabled={quotaInfo.remaining <= 0}
                                >
                                    🤖 AI
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
                                    {results.map(verse => (
                                        <div
                                            key={verse.id}
                                            className="result-card card"
                                            onClick={() => navigate('/bible', {
                                                state: {
                                                    bookId: verse.books.id,
                                                    chapter: verse.chapter,
                                                    targetVerse: verse.verse
                                                }
                                            })}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="result-header">
                                                <span className="result-reference">
                                                    {getVerseReference(verse)}
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
                                <button className="close-btn" onClick={() => setShowAIModal(false)}>✕</button>
                            </div>
                            <div className="modal-body info-body">
                                <div className="info-section">
                                    <h3>Ask your question:</h3>
                                    <textarea
                                        className="ai-question-input"
                                        placeholder="e.g., What does the Bible say about faith? How should Christians respond to suffering?"
                                        value={aiQuestion}
                                        onChange={(e) => setAiQuestion(e.target.value)}
                                        rows={3}
                                    />
                                    <button
                                        className="btn-primary"
                                        onClick={submitAIQuestion}
                                        disabled={aiLoading || !aiQuestion.trim()}
                                        style={{ marginTop: '10px', width: '100%' }}
                                    >
                                        {aiLoading ? '⏳ AI is thinking...' : '💬 Submit Question'}
                                    </button>
                                </div>

                                {aiResponse && (
                                    <div className="info-section ai-response">
                                        <h3>📚 Biblical Answer:</h3>
                                        <div className="ai-answer">
                                            {formatAIResponse(aiResponse)}
                                        </div>
                                    </div>
                                )}

                                <div className="info-footer">
                                    <p>📈 {quotaInfo.remaining} questions remaining today (based on {quotaInfo.quota} daily limit)</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '5px' }}>AI responses are based on search results and biblical text.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            );
}

            export default Search;
