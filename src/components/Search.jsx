import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchVerses, getVerseReference, getBooks, getVerseByReference, getUserId } from '../services/bibleService';
import { useSettings } from '../context/SettingsContext';
import SearchHelpModal from './SearchHelpModal';
import { askBibleQuestion, getUserRemainingQuota, performSemanticSearch } from '../services/aiService';
import { getLocalizedBookName } from '../constants/bookNames';
import { saveBulkHighlights, removeBulkHighlights, getAllHighlights } from '../services/highlightService';
import ColorPickerModal from './ColorPickerModal';

function Search({ currentVersion, versions }) {
    const isSearchingRef = useRef(false);
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
    const [isHistoryEditMode, setIsHistoryEditMode] = useState(false);

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
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [searchMode, setSearchMode] = useState('exact'); // 'exact' or 'semantic'
    const [semanticResults, setSemanticResults] = useState([]); // Verses with AI reasons
    const [semanticSummary, setSemanticSummary] = useState(''); // AI biblical reflection
    const [currentUserId, setCurrentUserId] = useState(null);
    const [showMobileResults, setShowMobileResults] = useState(false);

    // Bulk Highlight State
    const [selectedVerses, setSelectedVerses] = useState(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    // Toggle single verse selection
    const toggleVerseSelection = (verseKey, e) => {
        e.stopPropagation(); // Prevent navigation
        const newSet = new Set(selectedVerses);
        if (newSet.has(verseKey)) {
            newSet.delete(verseKey);
        } else {
            newSet.add(verseKey);
        }
        setSelectedVerses(newSet);
        setIsSelectMode(newSet.size > 0);
    };

    // Select/Deselect All visible results
    const handleSelectAll = () => {
        const targetResults = searchMode === 'semantic' ? semanticResults : results;
        if (selectedVerses.size === targetResults.length) {
            setSelectedVerses(new Set());
            setIsSelectMode(false);
        } else {
            const newSet = new Set();
            targetResults.forEach(v => {
                // Unique key: BookID-Chapter-Verse-Version
                const key = `${v.books.id}-${v.chapter}-${v.verse}-${v.version}`;
                newSet.add(key);
            });
            setSelectedVerses(newSet);
            setIsSelectMode(true);
        }
    };

    const handleBulkHighlight = async (color) => {
        setShowColorPicker(false);
        if (selectedVerses.size === 0) return;

        const targetResults = searchMode === 'semantic' ? semanticResults : results;
        const versesToHighlight = [];

        targetResults.forEach(v => {
            const key = `${v.books.id}-${v.chapter}-${v.verse}-${v.version}`;
            if (selectedVerses.has(key)) {
                versesToHighlight.push({
                    bookId: v.books.id,
                    chapter: v.chapter,
                    verse: v.verse,
                    version: v.version
                });
            }
        });


        let result;
        if (color === 'REMOVE') {
            result = await removeBulkHighlights(versesToHighlight);
        } else {
            result = await saveBulkHighlights(versesToHighlight, color);
        }

        if (result.success) {
            // Success! Clear selection
            setSelectedVerses(new Set());
            setIsSelectMode(false);
            // Optional: Show toast or feedback
            const msg = color === 'REMOVE'
                ? (settings.language === 'af' ? 'Verwyder!' : 'Removed!')
                : (settings.language === 'af' ? 'Gestoor!' : 'Saved!');

            setCopyStatus(msg);
            setTimeout(() => setCopyStatus('Copy'), 2000);

            // Refresh highlights to update UI
            refreshHighlights();  // We need to re-fetch to update checked state (unchecked)
        } else {
            alert('Failed to update highlights');
        }
    };

    const AI_SHORTCUTS = [
        { cmd: '/story', desc: settings.language === 'af' ? 'Vertel my die storie van...' : 'Tell me the story of...', icon: '📖' },
        { cmd: '/explain', desc: settings.language === 'af' ? 'Verduidelik vanuit die Bybel...' : 'Explain from the Bible...', icon: '💡' },
        { cmd: '/meaning', desc: settings.language === 'af' ? 'Bybelse betekenis van...' : 'Biblical meaning of...', icon: '📚' },
        { cmd: '/who', desc: settings.language === 'af' ? 'Wie was...' : 'Who was...', icon: '👤' },
        { cmd: '/what', desc: settings.language === 'af' ? 'Wat was...' : 'What was...', icon: '❓' },
        { cmd: '/why', desc: settings.language === 'af' ? 'Waarom het...' : 'Why did...', icon: '🤔' },
        { cmd: '/teach', desc: settings.language === 'af' ? 'Wat leer die Bybel oor...' : 'What does the Bible teach...', icon: '🎓' },
        { cmd: '/compare', desc: settings.language === 'af' ? 'Vergelyk in die Bybel...' : 'Compare in the Bible...', icon: '⚖️' },
        { cmd: '/help', desc: settings.language === 'af' ? 'Wys alle kortpaaie' : 'Show all shortcuts', icon: 'ℹ️' },
    ];

    const t = {
        aiTitle: settings.language === 'af' ? '🤖 AI Bybel Navorsing' : '🤖 AI Bible Research',
        backToResults: settings.language === 'af' ? '⬅ Terug na Resultate' : '⬅ Back to Results',
        askQuestion: settings.language === 'af' ? 'Stel jou vraag:' : 'Ask your question:',
        aiPlaceholder: settings.language === 'af' ? 'b.v., Wat sê die Bybel oor geloof? Hoe moet Christene op lyding reageer?' : 'e.g., What does the Bible say about faith? How should Christians respond to suffering?',
        quickCommands: settings.language === 'af' ? '⚡ Vinnige Opdragte' : '⚡ Quick Commands',
        submitQuestion: settings.language === 'af' ? '💬 Stuur Vraag' : '💬 Submit Question',
        thinking: settings.language === 'af' ? '⏳ AI dink tans...' : '⏳ AI is thinking...',
        biblicalAnswer: settings.language === 'af' ? '📚 Bybelse Antwoord:' : '📚 Biblical Answer:',
        copy: settings.language === 'af' ? 'Kopieer' : 'Copy',
        copied: settings.language === 'af' ? 'Gekopieer!' : 'Copied!',
        expand: settings.language === 'af' ? '⤢ Brei uit' : '⤢ Expand',
        collapse: settings.language === 'af' ? '✕ Maak toe' : '✕ Close',
        questionsRemaining: (rem, total) => settings.language === 'af'
            ? `📈 ${rem} vrae oor vandag (gebaseer op ${total} daaglikse limiet)`
            : `📈 ${rem} questions remaining today (based on ${total} daily limit)`,
        aiDisclaimer: settings.language === 'af'
            ? 'AI-antwoorde is gebaseer op soekresultate en bybelse teks.'
            : 'AI responses are based on search results and biblical text.',
        prevQuestions: (count) => settings.language === 'af'
            ? `📜 Vorige Vrae (${count})`
            : `📜 Previous Questions (${count})`,
        view: settings.language === 'af' ? 'Bekyk' : 'View',
        clearHistory: settings.language === 'af' ? '🗑️ Vee Geskiedenis uit' : '🗑️ Clear History'
    };


    // Load history and AI state on mount
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('search_history');
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                if (Array.isArray(parsed)) {
                    setHistory(parsed);
                }
            }
        } catch (e) {
            console.warn("History load failed", e);
        }

        try {
            const savedAIHistory = localStorage.getItem('ai_search_history');
            if (savedAIHistory) {
                const parsed = JSON.parse(savedAIHistory);
                if (Array.isArray(parsed)) {
                    setAiHistory(parsed);
                }
            }
        } catch (e) {
            console.warn("AI history load failed", e);
        }
        try {
            const savedAI = sessionStorage.getItem('bible_ai_session');
            if (savedAI) {
                const { question, response, showModal, expanded, timestamp } = JSON.parse(savedAI);
                // Valid for 1 hour
                if (Date.now() - timestamp < 3600000) {
                    setAiQuestion(question);
                    setAiResponse(response);
                    // Do not auto-open modal on reload, user must explicitly click button
                    // setShowAIModal(showModal); 

                    // If we have a response, we can restore the expanded state
                    // If there's no response, expanded should be false to show the input box
                    if (response && expanded) {
                        setIsAnswerExpanded(true);
                    } else {
                        setIsAnswerExpanded(false);
                    }
                }
            }
        } catch (e) {
            console.warn("AI session restore failed", e);
        }

        const fetchUserId = async () => {
            const id = await getUserId();
            setCurrentUserId(id);
        };
        fetchUserId();

        loadQuotaInfo();
        loadBooks();
    }, []);

    const refreshHighlights = async () => {
        const targetResults = searchMode === 'semantic' ? semanticResults : results;
        if (targetResults.length === 0) return;

        try {
            const result = await getAllHighlights();
            if (result.success && result.highlights) {
                const highlightedRefs = new Set();
                result.highlights.forEach(h => {
                    highlightedRefs.add(`${h.book_id}-${h.chapter}-${h.verse}`);
                });

                const newSelected = new Set(selectedVerses);

                targetResults.forEach(v => {
                    if (highlightedRefs.has(`${v.books.id}-${v.chapter}-${v.verse}`)) {
                        const key = `${v.books.id}-${v.chapter}-${v.verse}-${v.version}`;
                        newSelected.add(key);
                    } else if (isSelectMode) {
                        // Crucial: If we are refreshing, we should UNCHECK verses that are no longer highlighted
                        // ONLY IF they were selected purely because they were highlighted?
                        // Or should we just sync state strictly?
                        // User request: "as soon as they click mark or remove mark that the checkbox can be updated immediately"
                        // So if I just REMOVED a highlight, I expect the box to UNCHECK.
                        const key = `${v.books.id}-${v.chapter}-${v.verse}-${v.version}`;
                        // To be safe, let's just re-evaluate "highlighted status" vs "manual selection".
                        // Actually, the current logic only ADDS. It doesn't REMOVE.
                        // To support "unmark -> uncheck", we need to check if it's NO LONGER in highlightedRefs.
                        // But wait, manual selection is also a thing.
                        // If I manually selected it to highlighting it, and then highlighted it, it ends up highlighted.
                        // If I manually selected it to remove highlight, and remove it, it is no longer highlighted.
                        // Should it stay selected? No, probably not.
                        // If I just finished a bulk action, I clear selection anyway (lines 111-113).
                        // So `selectedVerses` is cleared to empty Set.
                        // Then `loadExistingHighlights` (or `refreshHighlights`) runs.
                        // It should populate `selectedVerses` ONLY with verses that are currently highlighted.
                    }
                });

                // Since we clear selections on success, this logic serves to RE-populate based on DB state.
                if (newSelected.size > 0) {
                    setSelectedVerses(newSelected);
                    // Only Force Select Mode if we actually have selections?
                    // Actually, if we have highlighted verses, we might NOT want to force "Select Mode" visually 
                    // if it changes the UI too much? 
                    // But the user accepted the "pre-check" logic previously.
                    setIsSelectMode(true);
                } else {
                    // If nothing is highlighted effectively, we might want to turn off select mode?
                    // Only if we just cleared it.
                }
            }
        } catch (e) {
            console.error("Error refreshing highlights", e);
        }
    };

    // Effect to check verses when results change
    useEffect(() => {
        refreshHighlights();
    }, [results, semanticResults]); // Run when results update

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

    const addToHistory = (query, mode = 'exact') => {
        if (!query || query.trim() === '') return;
        const item = { query: query.trim(), mode };
        const newHistory = [item, ...history.filter(h => {
            const hQuery = typeof h === 'string' ? h : h.query;
            return hQuery !== query.trim();
        })].slice(0, 30);
        setHistory(newHistory);
        localStorage.setItem('search_history', JSON.stringify(newHistory));
    };

    const handleHistoryItemDelete = (termToDelete) => {
        const queryToDelete = typeof termToDelete === 'string' ? termToDelete : termToDelete.query;
        if (!window.confirm(`Delete "${queryToDelete}" from history?`)) return;

        const newHistory = history.filter(h => {
            const hQuery = typeof h === 'string' ? h : h.query;
            return hQuery !== queryToDelete;
        });
        setHistory(newHistory);
        localStorage.setItem('search_history', JSON.stringify(newHistory));
    };
    // Auto-search on mount or param change
    useEffect(() => {
        const query = searchParams.get('q');
        const ver = searchParams.get('version');
        const test = searchParams.get('testament');

        if (query) {
            // Only sync URL to input if we AREN'T currently triggering a search manually
            if (!isSearchingRef.current) {
                setSearchQuery(query);
            }
            isSearchingRef.current = false; // Reset for next sync (e.g. back button)

            if (ver) setSearchVersion(ver);
            if (test) setSearchTestament(test);

            const mode = searchParams.get('mode') || 'exact';
            setSearchMode(mode);

            // Check session cache first for instant "back" navigation
            try {
                const cached = sessionStorage.getItem('bible_search_cache');
                if (cached) {
                    const { query: cachedQuery, version: cachedVer, testament: cachedTest, mode: cachedMode, data, timestamp } = JSON.parse(cached);
                    // Use cache only if query, version, testament AND mode match
                    const currentVer = ver || 'all';
                    const currentTest = test || 'all';
                    const currentMode = mode || 'exact';

                    if (cachedQuery === query &&
                        cachedVer === currentVer &&
                        cachedTest === currentTest &&
                        cachedMode === currentMode &&
                        data &&
                        (Date.now() - timestamp < 3600000)) {

                        if (currentMode === 'semantic') {
                            setSemanticResults(data.results || data); // Support old cache format just in case
                            setSemanticSummary(data.summary || '');
                            setResults([]);
                        } else {
                            setResults(data);
                            setSemanticResults([]);
                            setSemanticSummary('');
                        }
                        setHasSearched(true);
                        setLoading(false);
                        setShowMobileResults(true); // Switch to results view
                        return;
                    }
                }
            } catch (e) {
                console.warn("Cache read error", e);
            }

            performSearch(query, ver || 'all', test || 'all', mode);
        }
    }, [searchParams]);

    const performSearch = async (query, versionId, testament, mode = 'exact') => {
        if (!query.trim()) return;

        // Jump to results immediately (especially for slow AI searches)
        setShowMobileResults(true);
        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setSemanticResults([]);
        setSemanticSummary('');

        addToHistory(query.trim(), mode);

        if (mode === 'semantic') {
            console.log("🚀 Starting Semantic Search for:", query);
            const { performSemanticSearch } = await import('../services/aiService');
            const uid = currentUserId || await getUserId();
            const aiResult = await performSemanticSearch(uid, query.trim(), versionId, testament, settings.language);

            console.log("🤖 AI raw result:", aiResult);

            if (aiResult.success) {
                const resultsToResolve = aiResult.data.results || [];
                const summary = aiResult.data.summary || '';

                // Now resolve references to actual verses
                const resolvedVerses = [];
                for (const item of resultsToResolve) {
                    console.log(`🔎 Resolving: ${item.ref}`);
                    // Use active version as default if "all" is selected
                    const defaultVer = currentVersion?.id || 'KJV';
                    const verseResult = await getVerseByReference(item.ref, versionId === 'all' ? defaultVer : versionId);
                    if (verseResult.success) {
                        resolvedVerses.push({
                            ...verseResult.data,
                            semanticReason: item.reason
                        });
                    } else {
                        console.warn(`❌ Failed to resolve verse: ${item.ref}`, verseResult.error);
                    }
                }

                console.log(`✅ Final resolved verses count: ${resolvedVerses.length}`);
                setSemanticResults(resolvedVerses);
                setSemanticSummary(summary);
                setResults([]);
                setShowMobileResults(true); // Switch to results view

                // Cache successful results
                try {
                    sessionStorage.setItem('bible_search_cache', JSON.stringify({
                        query: query.trim(),
                        version: versionId,
                        testament: testament,
                        mode: mode,
                        data: {
                            results: resolvedVerses,
                            summary: summary
                        },
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn("Cache write error", e);
                }
            } else {
                setSemanticResults([]);
                setSemanticSummary('');
                console.error("❌ Semantic search failed:", aiResult.error);
                setShowMobileResults(true); // Show empty state
            }
        } else {
            const result = await searchVerses(query.trim(), versionId, testament);

            if (result.success) {
                setResults(result.data);
                setSemanticResults([]);
                setSemanticSummary('');
                setShowMobileResults(true); // Switch to results view
                // Cache successful results
                try {
                    sessionStorage.setItem('bible_search_cache', JSON.stringify({
                        query: query.trim(),
                        version: versionId,
                        testament: testament,
                        mode: mode,
                        data: result.data,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn("Cache write error", e);
                }
            } else {
                setResults([]);
                setShowMobileResults(true); // Show empty state
            }
        }

        setLoading(false);
    };

    const handleCopyAllSemantic = () => {
        if (!semanticSummary && semanticResults.length === 0) return;

        let text = "";
        if (settings.language === 'af') {
            text += `BYBELSE NADINKE 🕊️\n"${searchQuery}"\n\n${semanticSummary}\n\nRELEVANTE VERSE:\n`;
        } else {
            text += `BIBLICAL REFLECTION 🕊️\n"${searchQuery}"\n\n${semanticSummary}\n\nRELEVANT VERSES:\n`;
        }

        semanticResults.forEach(v => {
            text += `\n[${v.version}] ${v.books.name_full} ${v.chapter}:${v.verse}\n${v.text}\n💡 ${v.semanticReason}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus(settings.language === 'af' ? 'Gekopieer!' : 'Copied!');
            setTimeout(() => setCopyStatus('Copy'), 2000);
        });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        isSearchingRef.current = true;
        // Update URL
        setSearchParams({ q: searchQuery.trim(), version: searchVersion, testament: searchTestament, mode: searchMode });
        // Clear input as requested by user
        setSearchQuery('');
        setShowHistory(false); // Close history when searching
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
        // Update local state
        if (key === 'version') setSearchVersion(value);
        if (key === 'testament') setSearchTestament(value);
        if (key === 'mode') {
            setSearchMode(value);
            return; // DO NOT trigger search immediately for mode changes
        }

        // Update URL to trigger search (for version and testament)
        const newParams = { q: searchQuery, version: searchVersion, testament: searchTestament, mode: searchMode };
        newParams[key] = value;

        isSearchingRef.current = true;
        setSearchParams(newParams);

        // If we have a query, jump to results screen immediately on mobile
        if (searchQuery.trim()) {
            setShowMobileResults(true);
        }

        setShowHistory(false);
    };

    const loadQuotaInfo = async () => {
        const uid = currentUserId || await getUserId();
        const info = await getUserRemainingQuota(uid);
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
        setIsAnswerExpanded(false); // Reset expanded mode for new questions
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

        const uid = currentUserId || await getUserId();
        const result = await askBibleQuestion(uid, processedQuestion, verseContext, settings.language);

        setAiLoading(false);

        if (result.success) {
            setAiResponse(result.answer);
            setIsAnswerExpanded(true); // Auto-expand for better readability

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
        <div className={`search-page ${showMobileResults ? 'mobile-results-open' : ''}`}>
            <div className="search-header">
                <div className="header-top-row">
                    {showMobileResults ? (
                        <button
                            className="back-to-search-btn"
                            onClick={() => setShowMobileResults(false)}
                        >
                            ⬅ Back to Search
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <h1 className="search-title">Search the Bible</h1>
                            {/* Show "View Results" if we have results but are in search mode (mobile) */}
                            {((results.length > 0 || semanticResults.length > 0) || hasSearched) && (
                                <button
                                    className="view-results-btn"
                                    onClick={() => setShowMobileResults(true)}
                                    title="Back to Results"
                                >
                                    👀 View Results
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        className="info-btn"
                        onClick={() => setShowHelpModal(true)}
                        title="Help & Info"
                    >
                        ℹ️
                    </button>
                </div>

                <div className="search-input-container">
                    <form onSubmit={handleSearch} className="search-form">
                        {/* Row 1: Input + History Toggle */}
                        <div className="search-bar-row">
                            <input
                                type="text"
                                className="search-input input"
                                placeholder={
                                    searchMode === 'semantic'
                                        ? (settings.language === 'af' ? "bv. 'ek voel alleen' of 'krag in moeilike tye'..." : "e.g., 'feeling lonely' or 'strength in hard times'...")
                                        : (settings.language === 'af' ? "Soek vir trefwoorde of verse..." : "Search for keywords or verses...")
                                }
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
                            // Removed onClick that automatically showed history
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
                                {loading ? '...' : (searchQuery.startsWith('/') ? '🤖 Ask AI' : (searchMode === 'semantic' ? '🪄 Concept Search' : '🔍 Exact Search'))}
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
                                {history.map((item, i) => (
                                    <button
                                        key={i}
                                        className="history-item"
                                        onClick={() => {
                                            const query = typeof item === 'string' ? item : item.query;
                                            const mode = typeof item === 'string' ? 'exact' : item.mode;
                                            setSearchQuery(query);
                                            setSearchParams({ q: query, version: searchVersion, testament: searchTestament, mode: mode });
                                            setShowHistory(false);
                                        }}
                                    >
                                        🕒 {(typeof item === 'string' ? item : item.query)} {(typeof item !== 'string' && item.mode === 'semantic') ? '🤖' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="search-filters">
                    <div className="mode-toggle">
                        <div className={`mode-slider ${searchMode}`}></div>
                        <button
                            className={`mode-btn ${searchMode === 'exact' ? 'active' : ''}`}
                            onClick={() => handleFilterChange('mode', 'exact')}
                            type="button"
                        >
                            {settings.language === 'af' ? 'Presiese Soektog' : 'Exact Match'}
                        </button>
                        <button
                            className={`mode-btn ${searchMode === 'semantic' ? 'active' : ''}`}
                            onClick={() => handleFilterChange('mode', 'semantic')}
                            type="button"
                        >
                            {settings.language === 'af' ? 'Konsep-soektog 🤖' : 'Concept Search 🤖'}
                        </button>
                    </div>

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

            {/* Elevated Recent History Bar */}
            {
                history.length > 0 && (
                    <div className="recent-history-bar-container">
                        <div className="history-bar-header">
                            <span className="history-label">{settings.language === 'af' ? 'Onlangse' : 'Recent'}</span>
                            <button
                                className={`history-manage-btn ${isHistoryEditMode ? 'active' : ''}`}
                                onClick={() => setIsHistoryEditMode(!isHistoryEditMode)}
                            >
                                {isHistoryEditMode
                                    ? (settings.language === 'af' ? 'Klaar' : 'Done')
                                    : (settings.language === 'af' ? 'Bestuur' : 'Manage')}
                            </button>
                        </div>
                        <div className={`recent-history-bar ${isHistoryEditMode ? 'edit-mode' : ''}`}>
                            {history.map((term, i) => {
                                const query = term && typeof term === 'object' ? term.query : (typeof term === 'string' ? term : '');
                                const mode = term && typeof term === 'object' ? term.mode : 'exact';
                                if (!query) return null;
                                return (
                                    <button
                                        key={`${i}-${query}`}
                                        className={`history-chip ${mode === 'semantic' ? 'semantic' : ''} ${isHistoryEditMode ? 'deletable' : ''}`}
                                        style={{ '--i': i }}
                                        onClick={() => {
                                            if (isHistoryEditMode) {
                                                handleHistoryItemDelete(term);
                                            } else {
                                                // Clear input as requested by user
                                                setSearchQuery('');
                                                setSearchMode(mode);
                                                setSearchParams({ q: query, version: searchVersion, testament: searchTestament, mode: mode });
                                            }
                                        }}
                                    >
                                        <span className="chip-icon">{mode === 'semantic' ? '🤖' : '🔍'}</span>
                                        {query}
                                        {isHistoryEditMode && <span className="delete-chip-icon">✕</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            <div className="search-results">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>{settings.language === 'af' ? 'Besig om te soek...' : 'Searching...'}</p>
                    </div>
                ) : hasSearched ? (
                    (results.length > 0 || semanticResults.length > 0) ? (
                        <>
                            <div className="results-header">
                                <p className="results-count">
                                    {settings.language === 'af'
                                        ? `${results.length || semanticResults.length} vers${(results.length || semanticResults.length) !== 1 ? 'e' : ''} gevind`
                                        : `Found ${results.length || semanticResults.length} verse${(results.length || semanticResults.length) !== 1 ? 's' : ''}`
                                    }
                                </p>
                                <div className="results-header-actions">
                                    {searchMode === 'semantic' && (semanticSummary || semanticResults.length > 0) && (
                                        <button
                                            className="copy-all-btn btn-secondary"
                                            onClick={handleCopyAllSemantic}
                                        >
                                            {copyStatus === 'Copy' ? (settings.language === 'af' ? '📋 Kopieer Alles' : '📋 Copy All') : `✅ ${copyStatus}`}
                                        </button>
                                    )}
                                    <button
                                        className="ai-research-btn btn-primary"
                                        onClick={handleAskAI}
                                        disabled={quotaInfo.remaining <= 0}
                                    >
                                        🤖 Ask AI ({quotaInfo.remaining} left)
                                    </button>
                                </div>
                            </div>

                            {/* Bulk Action Bar */}
                            {(results.length > 0 || semanticResults.length > 0) && (
                                <div className="bulk-action-bar">
                                    <label className="select-all-label">
                                        <input
                                            type="checkbox"
                                            className="select-all-checkbox"
                                            checked={selectedVerses.size > 0 && selectedVerses.size === (searchMode === 'semantic' ? semanticResults.length : results.length)}
                                            onChange={handleSelectAll}
                                        />
                                        <span>{settings.language === 'af' ? 'Kies Alles' : 'Select All'} ({selectedVerses.size})</span>
                                    </label>

                                    <button
                                        className="bulk-highlight-btn"
                                        onClick={() => setShowColorPicker(true)}
                                        disabled={selectedVerses.size === 0}
                                        title={settings.language === 'af' ? 'Merk gekose verse' : 'Highlight selected verses'}
                                    >
                                        🖌️ <span className="btn-label">{settings.language === 'af' ? 'Merk' : 'Highlight'}</span>
                                    </button>
                                </div>
                            )}

                            <div
                                className="results-list"
                                style={{
                                    fontSize: `${settings.fontSize}px`,
                                    fontFamily: settings.fontFamily === 'serif' ? '"Merriweather", "Times New Roman", serif' : 'system-ui, -apple-system, sans-serif'
                                }}
                            >
                                {searchMode === 'semantic' && semanticSummary && (
                                    <div className="semantic-summary-box">
                                        <h3>{settings.language === 'af' ? 'Bybelse Nadinke 🕊️' : 'Biblical Reflection 🕊️'}</h3>
                                        <p>{semanticSummary}</p>
                                    </div>
                                )}

                                {searchMode === 'semantic' ? (
                                    semanticResults.map((verse, index) => {
                                        const key = `${verse.books.id}-${verse.chapter}-${verse.verse}-${verse.version}`;
                                        const isSelected = selectedVerses.has(key);
                                        return (
                                            <div key={index} className={`verse-card semantic-card ${isSelected ? 'selected' : ''}`} onClick={() => {
                                                navigate('/bible', {
                                                    state: {
                                                        bookId: verse.books.id,
                                                        chapter: verse.chapter,
                                                        targetVerse: verse.verse,
                                                        fromSearch: true,
                                                        searchParams: {
                                                            q: searchQuery,
                                                            version: searchVersion,
                                                            testament: searchTestament,
                                                            mode: searchMode
                                                        }
                                                    }
                                                });
                                            }}>
                                                <div className="result-header">
                                                    <div className="header-left">
                                                        <span className="result-ref">
                                                            {getLocalizedBookName(verse.books.name_full, verse.version === 'AFR53' || verse.version === 'AFR83' ? 'af' : settings.language)} {verse.chapter}:{verse.verse}
                                                        </span>
                                                        <span className="semantic-badge">AI Reason</span>
                                                        <span className="result-version">
                                                            {verse.version}
                                                        </span>
                                                    </div>
                                                    <div className="selection-checkbox" onClick={(e) => toggleVerseSelection(key, e)}>
                                                        {isSelected ? '☑️' : '⬜'}
                                                    </div>
                                                </div>
                                                <p className="semantic-reason">
                                                    {verse.semanticReason}
                                                </p>
                                                <p className="result-text">
                                                    {verse.text}
                                                </p>
                                            </div>
                                        );
                                    })
                                ) : (
                                    results.map((verse, index) => {
                                        const key = `${verse.books.id}-${verse.chapter}-${verse.verse}-${verse.version}`;
                                        const isSelected = selectedVerses.has(key);
                                        return (
                                            <div key={index} className={`verse-card ${isSelected ? 'selected' : ''}`} onClick={() => {
                                                navigate('/bible', {
                                                    state: {
                                                        bookId: verse.books.id,
                                                        chapter: verse.chapter,
                                                        targetVerse: verse.verse,
                                                        fromSearch: true,
                                                        searchParams: {
                                                            q: searchQuery,
                                                            version: searchVersion,
                                                            testament: searchTestament,
                                                            mode: searchMode
                                                        }
                                                    }
                                                });
                                            }}>
                                                <div className="result-header">
                                                    <div className="header-left">
                                                        <span className="result-ref">
                                                            {getLocalizedBookName(verse.books.name_full, verse.version === 'AFR53' || verse.version === 'AFR83' ? 'af' : settings.language)} {verse.chapter}:{verse.verse}
                                                        </span>
                                                        <span className="result-version">
                                                            {verse.version}
                                                        </span>
                                                    </div>
                                                    <div className="selection-checkbox" onClick={(e) => toggleVerseSelection(key, e)}>
                                                        {isSelected ? '☑️' : '⬜'}
                                                    </div>
                                                </div>
                                                <p className="result-text">
                                                    {highlightText(verse.text, searchQuery)}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
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
                    null // Clean home screen as requested
                )}
            </div>

            {/* AI Research Modal */}
            {
                showAIModal && (
                    <div className="book-selector-modal ai-research-modal" onClick={() => { setShowAIModal(false); setIsAnswerExpanded(false); }}>
                        <div className="book-selector-content info-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{t.aiTitle}</h2>
                                <button className="close-btn back-to-results" onClick={() => { setShowAIModal(false); setIsAnswerExpanded(false); }}>
                                    {t.backToResults}
                                </button>
                            </div>
                            <div className="modal-body info-body">
                                {!isAnswerExpanded && (
                                    <div className="info-section">
                                        <h3>{t.askQuestion}</h3>
                                        <textarea
                                            className="ai-question-input"
                                            placeholder={t.aiPlaceholder}
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
                                                <div className="shortcut-header">{t.quickCommands}</div>
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
                                            {aiLoading ? t.thinking : t.submitQuestion}
                                        </button>
                                    </div>
                                )}

                                {aiResponse && (
                                    <div
                                        className={`info-section ai-response ${isAnswerExpanded ? 'expanded' : ''}`}
                                        onDoubleClick={() => setIsAnswerExpanded(!isAnswerExpanded)}
                                    >
                                        <div className="ai-response-header">
                                            <h3>{t.biblicalAnswer}</h3>
                                            <div className="ai-response-actions">
                                                <button
                                                    className={`copy-btn ${copyStatus === 'Copied!' ? 'success' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyToClipboard();
                                                    }}
                                                    title="Copy to clipboard"
                                                >
                                                    {copyStatus === 'Copied!' ? '✅ ' : '📋 '}{copyStatus === 'Copied!' ? t.copied : t.copy}
                                                </button>
                                                {!isAnswerExpanded && (
                                                    <button
                                                        className="expand-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsAnswerExpanded(true);
                                                        }}
                                                    >
                                                        {t.expand}
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
                                                        {t.collapse}
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
                                        <p>{t.questionsRemaining(quotaInfo.remaining, quotaInfo.quota)}</p>
                                        <p style={{ fontSize: '0.75rem', marginTop: '5px' }}>{t.aiDisclaimer}</p>
                                    </div>
                                )}

                                {/* AI History Section */}
                                {aiHistory.length > 0 && (
                                    <div className="ai-history-section">
                                        <button
                                            className="ai-history-toggle"
                                            onClick={() => setShowAIHistory(!showAIHistory)}
                                        >
                                            {t.prevQuestions(aiHistory.length)}
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
                                                                    if (item.answer) {
                                                                        setAiResponse(item.answer);
                                                                        setIsAnswerExpanded(true); // Auto-expand for visibility
                                                                    } else {
                                                                        // Fallback if no answer saved
                                                                        setAiResponse(null);
                                                                    }
                                                                }}
                                                                title="View this answer"
                                                            >
                                                                {t.view}
                                                            </button>
                                                        </div>
                                                        <div className="ai-history-date">
                                                            {new Date(item.timestamp).toLocaleDateString(settings.language === 'af' ? 'af-ZA' : 'en-US')}
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    className="clear-ai-history-btn"
                                                    onClick={() => {
                                                        if (window.confirm(settings.language === 'af' ? 'Is jy seker jy wil jou geskiedenis uitvee?' : 'Are you sure you want to clear your history?')) {
                                                            setAiHistory([]);
                                                            localStorage.removeItem('ai_search_history');
                                                        }
                                                    }}
                                                >
                                                    {t.clearHistory}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Help Info Modal */}
            {
                showHelpModal && (
                    <SearchHelpModal
                        onClose={() => setShowHelpModal(false)}
                        language={settings.language}
                    />
                )
            }
            {/* Bulk Color Picker */}
            <ColorPickerModal
                isOpen={showColorPicker}
                onClose={() => setShowColorPicker(false)}
                onSelectColor={handleBulkHighlight}
                allowNaming={true}
                language={settings.language}
            />
        </div>
    );
}

export default Search;
