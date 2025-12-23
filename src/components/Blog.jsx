import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserId, getBooks } from '../services/bibleService';
import {
    getRecommendedPosts,
    getDailyDevotional,
    getTrendingTopics,
    analyzeUserInterests,
    checkRefreshCooldown,
    getSearchKeywords,
    toggleKeywordHighlight,
    hideSearchKeyword
} from '../services/blogService';
import { useSettings } from '../context/SettingsContext';
import { AFRIKAANS_BOOK_NAMES } from '../constants/bookNames';
import './Blog.css';

function Blog() {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const prevLanguage = useRef(settings.language);
    const [posts, setPosts] = useState([]);
    const [devotional, setDevotional] = useState(null);
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [userTopics, setUserTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [devotionalLoading, setDevotionalLoading] = useState(false);
    const [postsLoading, setPostsLoading] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [error, setError] = useState(null);
    const [allBooks, setAllBooks] = useState([]);
    const [cooldownMessage, setCooldownMessage] = useState(null);
    const [searchKeywords, setSearchKeywords] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);

    const translations = {
        en: {
            title: '✨ For You',
            subtitle: 'Personalized content based on your interests',
            todaysInspiration: '🌅 Today\'s Inspiration',
            newBtn: 'New',
            yourTopics: '🎯 Your Topics',
            topicsDesc: 'Based on your searches and questions',
            trending: '🔥 Trending Topics',
            recommended: '📚 Recommended Reading',
            noDevotional: 'No devotional yet. Click "New" to generate one based on your interests!',
            noArticles: 'No personalized articles yet. Keep searching or asking questions to get recommendations!',
            yourTopicsEmpty: 'Start searching to unlock personalized topics!',
            scriptureRefs: '📖 Scripture References',
            tryAgain: 'Try Again',
            loading: 'Could not load content. Please try again.',
            interestKeywords: '🔍 Search Keywords',
            interestKeywordsDesc: 'Toggle keywords to include/exclude them from recommendations. New searches are auto-highlighted.',
            interestKeywordsDescEdit: 'Tap a keyword to delete it permanently.',
            searchesLabel: 'searches',
            manageBtn: 'Manage',
            doneBtn: 'Done'
        },
        af: {
            title: '✨ Vir Jou',
            subtitle: 'Gepersonaliseerde inhoud gebaseer op jou belangstellings',
            todaysInspiration: 'Vandag se Inspirasie',
            newBtn: 'Nuut',
            yourTopics: '🎯 Jou Onderwerpe',
            topicsDesc: 'Gebaseer op jou soektogte en vrae',
            trending: '🔥 Gewilde Onderwerpe',
            recommended: '📚 Aanbevole Leesstof',
            noDevotional: 'Geen dagstukkie nog nie. Kliek "Nuut" om een te genereer gebaseer op jou belangstellings!',
            noArticles: 'Geen gepersonaliseerde artikels nie. Hou aan soek of vrae vra om aanbevelings te kry!',
            yourTopicsEmpty: 'Begin soek om gepersonaliseerde onderwerpe te ontsluit!',
            scriptureRefs: '📖 Skrifverwysings',
            tryAgain: 'Probeer Weer',
            loading: 'Kon nie inhoud laai nie. Probeer asseblief weer.',
            interestKeywords: '🔍 Soek Sleutelwoorde',
            interestKeywordsDesc: 'Skakel sleutelwoorde aan/af vir jou aanbevelings. Nuwe soektogte word outomaties beklemtoon.',
            interestKeywordsDescEdit: 'Raak \'n sleutelwoord om dit permanent te verwyder.',
            searchesLabel: 'soektogte',
            manageBtn: 'Bestuur',
            doneBtn: 'Klaar'
        }
    };

    const t = translations[settings.language] || translations.en;

    useEffect(() => {
        // If language changed, force refresh
        const force = settings.language !== prevLanguage.current;
        loadBlogContent(force);
        loadBooks();
        prevLanguage.current = settings.language;
    }, [settings.language]); // Reload when language changes

    const loadBooks = async () => {
        const result = await getBooks();
        if (result.success) {
            setAllBooks(result.data.all || []);
        }
    };

    const loadBlogContent = async (forceRefesh = false) => {
        setLoading(true);
        setError(null);

        try {
            const userId = await getUserId();

            // Load all content
            const [postsResult, devotionalResult, trendingResult, interestsResult, keywordsResult] = await Promise.all([
                getRecommendedPosts(userId, forceRefesh, settings.language),
                getDailyDevotional(userId, forceRefesh, settings.language),
                getTrendingTopics(),
                analyzeUserInterests(userId),
                getSearchKeywords(userId)
            ]);

            if (postsResult.success) {
                setPosts(postsResult.posts);
            }

            if (devotionalResult.success) {
                setDevotional(devotionalResult.devotional);
            }

            if (trendingResult.success) {
                setTrendingTopics(trendingResult.topics);
            }

            if (interestsResult.success) {
                setUserTopics(interestsResult.topics);
            }

            setSearchKeywords(keywordsResult || []);
        } catch (err) {
            console.error('Error loading blog content:', err);
            setError('Could not load content. Please try again.');
        }

        setLoading(false);
    };

    const refreshDevotional = async () => {
        const userId = await getUserId();

        // Check cooldown first
        const cooldown = await checkRefreshCooldown(userId);
        if (!cooldown.canRefresh) {
            setCooldownMessage(cooldown.message);
            setTimeout(() => setCooldownMessage(null), 4000);
            return;
        }

        setDevotionalLoading(true);
        const result = await getDailyDevotional(userId, true, settings.language);
        if (result.success) {
            setDevotional(result.devotional);
        } else {
            const msg = translations[settings.language].loading || 'Could not generate content';
            alert(`${msg}\n\nDetails: ${result.error || 'Unknown error'}`);
        }
        setDevotionalLoading(false);
    };

    const refreshPosts = async () => {
        const userId = await getUserId();

        // Check cooldown first
        const cooldown = await checkRefreshCooldown(userId);
        if (!cooldown.canRefresh) {
            setCooldownMessage(cooldown.message);
            setTimeout(() => setCooldownMessage(null), 4000);
            return;
        }

        setPostsLoading(true);
        const result = await getRecommendedPosts(userId, true, settings.language);
        if (result.success) {
            setPosts(result.posts);
        } else {
            const msg = translations[settings.language].loading || 'Could not generate content';
            alert(`${msg}\n\nDetails: ${result.error || 'Unknown error'}`);
        }
        setPostsLoading(false);
        // Refresh keywords too as generation might have updated used status
        const keywords = await getSearchKeywords(userId);
        setSearchKeywords(keywords);
    };

    const handleKeywordToggle = async (word) => {
        if (isEditMode) {
            handleKeywordDelete(word);
            return;
        }

        const userId = await getUserId();
        const keyword = searchKeywords.find(k => k.word === word);
        if (!keyword) return;

        const newStatus = !keyword.isHighlighted;

        // Optimistic update
        setSearchKeywords(prev => prev.map(k =>
            k.word === word ? { ...k, isHighlighted: newStatus } : k
        ));

        // Persist
        await toggleKeywordHighlight(userId, word, newStatus);
    };

    const handleKeywordDelete = async (word) => {
        if (!window.confirm(`Delete "${word}"?`)) return;

        const userId = await getUserId();

        // Optimistic delete
        setSearchKeywords(prev => prev.filter(k => k.word !== word));

        // Persist
        await hideSearchKeyword(userId, word);
    };

    const formatContent = (content) => {
        if (!content) return '';
        // Convert markdown-style bold to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br/>');
    };

    // Handle clicking on scripture reference - navigate to Bible reader
    const handleScriptureClick = (ref, e) => {
        e.stopPropagation(); // Prevent modal from closing
        setSelectedPost(null); // Close the modal

        try {
            // Clean up the string to get just the reference - handle full verse text being passed
            let cleanRef = ref.trim();

            // 1. Remove everything after (VERSION) if present
            if (cleanRef.includes(' (')) {
                cleanRef = cleanRef.split(' (')[0].trim();
            }

            // 2. Remove " sê:" or " says:" if present
            if (cleanRef.includes(' sê:')) cleanRef = cleanRef.split(' sê:')[0].trim();
            if (cleanRef.toLowerCase().includes(' says:')) {
                const parts = cleanRef.split(/ says:/i);
                cleanRef = parts[0].trim();
            }

            // 3. Handle cases where there might be a quote or extra colon text
            // Look for a colon that ISN'T part of the chapter:verse (usually followed by " or space)
            const colonQuoteIndex = cleanRef.indexOf(': "');
            if (colonQuoteIndex !== -1) cleanRef = cleanRef.substring(0, colonQuoteIndex).trim();

            // Find the last space to separate book from chapter:verse
            const lastSpaceIndex = cleanRef.lastIndexOf(' ');
            if (lastSpaceIndex === -1) {
                // Fallback to search if can't parse
                navigate(`/search?q=${encodeURIComponent(ref)}`);
                return;
            }

            const bookName = cleanRef.substring(0, lastSpaceIndex).trim();
            const refPart = cleanRef.substring(lastSpaceIndex + 1).trim(); // "6:9-13" or "3:16"

            // Extract chapter and verse (handle ranges like 9-13)
            const [chapterVerse] = refPart.split('-'); // Take first part if range
            const [chapter, verse] = chapterVerse.split(':');

            // Normalize book name for matching
            const normalizeBookName = (name) => {
                return name.toLowerCase().trim()
                    .replace(/^first /, '1 ')
                    .replace(/^second /, '2 ')
                    .replace(/^third /, '3 ')
                    .replace(/^i /, '1 ')
                    .replace(/^ii /, '2 ')
                    .replace(/^iii /, '3 ')
                    .replace(/^1st /, '1 ')
                    .replace(/^2nd /, '2 ')
                    .replace(/^3rd /, '3 ')
                    .replace(/^psalm$/, 'psalms')
                    .replace(/^proverb$/, 'proverbs')
                    .replace(/\./g, '')
                    .replace(/\s+/g, ' ');
            };

            const targetName = normalizeBookName(bookName);

            // Find matching book
            let book = allBooks.find(b => {
                const dbName = normalizeBookName(b.name_full);
                return dbName === targetName;
            });

            // Fallback 1: Check Afrikaans mapping
            if (!book) {
                const englishName = Object.keys(AFRIKAANS_BOOK_NAMES).find(key =>
                    normalizeBookName(AFRIKAANS_BOOK_NAMES[key]) === targetName
                );
                if (englishName) {
                    book = allBooks.find(b => normalizeBookName(b.name_full) === normalizeBookName(englishName));
                }
            }

            // Fallback 2: partial match if strict match failed
            if (!book) {
                book = allBooks.find(b => {
                    const dbName = normalizeBookName(b.name_full);
                    return dbName.startsWith(targetName) || targetName.startsWith(dbName);
                });
            }

            if (book) {
                // Navigate to Bible reader with the specific passage
                navigate('/bible', {
                    state: {
                        bookId: book.id,
                        chapter: parseInt(chapter),
                        targetVerse: parseInt(verse) || 1,
                        fromSearch: true
                    }
                });
            } else {
                // Fallback to search if book not found
                console.warn(`Book not found: ${bookName}`);
                navigate(`/search?q=${encodeURIComponent(ref)}`);
            }
        } catch (err) {
            console.error('Error parsing scripture reference:', err);
            navigate(`/search?q=${encodeURIComponent(ref)}`);
        }
    };

    const handleCopy = (text, e) => {
        if (e) e.stopPropagation();

        if (!text) {
            alert('Nothing to copy!');
            return;
        }

        console.log('Attempting to copy:', text.substring(0, 50) + '...');

        // Helper for fallback
        const fallbackCopy = (textToCopy) => {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;

                // Ensure valid style so it doesn't break layout but is invisible
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                textArea.setAttribute('readonly', '');

                document.body.appendChild(textArea);

                // Select text - iOS compat
                textArea.select();
                textArea.setSelectionRange(0, 99999);

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) {
                    alert('Copied to clipboard! 📋');
                } else {
                    alert('Copy failed. Please copy manually.');
                }
            } catch (err) {
                console.error('Fallback copy failed', err);
                alert('Copy failed.');
            }
        };

        // 1. Check if we can use modern API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => alert('Copied to clipboard! 📋'))
                .catch((err) => {
                    console.warn('Clipboard API failed, trying fallback...', err);
                    fallbackCopy(text);
                });
        } else {
            // 2. Immediate fallback for non-secure contexts
            fallbackCopy(text);
        }
    };

    if (loading) {
        return (
            <div className="blog-page">
                <div className="blog-header">
                    <h1>For You</h1>
                </div>
                <div className="blog-loading">
                    <div className="skeleton-card"></div>
                    <div className="skeleton-card"></div>
                    <div className="skeleton-card"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="blog-page">
            {/* Header */}
            <div className="blog-header">
                <h1>{t.title}</h1>
                <p className="blog-subtitle">{t.subtitle}</p>
            </div>

            {error && (
                <div className="blog-error">
                    <p>{error}</p>
                    <button onClick={() => loadBlogContent(true)}>{t.tryAgain}</button>
                </div>
            )}

            {/* Cooldown Toast */}
            {cooldownMessage && (
                <div className="cooldown-toast">
                    ⏳ {cooldownMessage}
                </div>
            )}

            {/* Daily Devotional Section */}
            <section className="blog-section devotional-section">
                <div className="section-header">
                    <h2>{t.todaysInspiration}</h2>
                    <button
                        className="refresh-btn"
                        onClick={refreshDevotional}
                        disabled={devotionalLoading}
                    >
                        {devotionalLoading ? '⏳' : '🔄'} {t.newBtn}
                    </button>
                </div>

                {devotional ? (
                    <div className="devotional-card">
                        <div className="devotional-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0 }}>{devotional.title || 'Daily Devotional'}</h3>
                            <button
                                className="icon-btn"
                                onClick={(e) => {
                                    const content = devotional.content || '';
                                    const text = `${devotional.title || 'Devotional'}\n\n${content}\n\nTopics: ${(devotional.topics || []).join(', ')}`;
                                    handleCopy(text, e);
                                }}
                                title="Copy content"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                        <div
                            className="devotional-content"
                            style={{ fontSize: `${settings.fontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: formatContent(devotional.content) }}
                        />
                        {devotional.topics && (
                            <div className="topic-chips">
                                {devotional.topics.map((topic, idx) => (
                                    <span key={idx} className="topic-chip">{topic}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="empty-devotional">
                        <p>{t.noDevotional}</p>
                    </div>
                )}
            </section>

            {/* Your Topics Section */}
            <section className="blog-section topics-section">
                <h2>{t.yourTopics}</h2>
                <p className="section-desc">{t.topicsDesc}</p>
                {userTopics.length > 0 ? (
                    <div className="topics-grid">
                        {userTopics.map((item, idx) => (
                            <div key={idx} className="topic-card">
                                <span className="topic-name">{item.topic}</span>
                                <span className="topic-weight">{item.weight} {settings.language === 'af' ? 'soektogte' : 'searches'}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-topics-hint">
                        <p>{t.yourTopicsEmpty}</p>
                    </div>
                )}
            </section>

            {/* Trending Topics */}
            {trendingTopics.length > 0 && (
                <section className="blog-section trending-section">
                    <h2>{t.trending}</h2>
                    <div className="trending-list">
                        {trendingTopics.map((item, idx) => (
                            <span key={idx} className="trending-chip">
                                #{item.topic}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* Recommended Articles */}
            <section className="blog-section articles-section">
                <div className="section-header">
                    <h2>{t.recommended}</h2>
                    <button
                        className="refresh-btn"
                        onClick={refreshPosts}
                        disabled={postsLoading}
                    >
                        {postsLoading ? '⏳' : '🔄'} {t.newBtn}
                    </button>
                </div>
                {posts.length === 0 ? (
                    <div className="empty-posts">
                        <p>{t.noArticles}</p>
                    </div>
                ) : (
                    <div className="posts-grid">
                        {posts.map(post => (
                            <article
                                key={post.id}
                                className="post-card"
                                onClick={() => setSelectedPost(post)}
                            >
                                <h3>{post.title}</h3>
                                <p className="post-summary">{post.summary}</p>
                                <div className="post-meta">
                                    <div className="post-topics">
                                        {(post.topics || []).slice(0, 3).map((topic, idx) => (
                                            <span key={idx} className="post-topic">{topic}</span>
                                        ))}
                                    </div>
                                    <span className="post-views">👁 {post.view_count || 0}</span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {/* Keyword Management Section - Listed beneath Recommended Reading */}
            <section className="blog-section keyword-management">
                <div className="section-header" style={{ justifyContent: 'space-between' }}>
                    <h2>{t.interestKeywords}</h2>
                    <button
                        className={`manage-btn ${isEditMode ? 'active' : ''}`}
                        onClick={() => setIsEditMode(!isEditMode)}
                    >
                        {isEditMode ? t.doneBtn : t.manageBtn}
                    </button>
                </div>
                <p className="section-desc">
                    {isEditMode ? t.interestKeywordsDescEdit : t.interestKeywordsDesc}
                </p>
                <div className={`keyword-buttons ${isEditMode ? 'edit-mode' : ''}`}>
                    {searchKeywords.map((item, idx) => (
                        <button
                            key={idx}
                            className={`keyword-btn ${item.isHighlighted ? 'highlighted' : ''} ${isEditMode ? 'deletable' : ''}`}
                            onClick={() => handleKeywordToggle(item.word)}
                        >
                            {isEditMode && <span className="delete-icon">✕</span>}
                            {item.word}
                            {!isEditMode && item.isHighlighted && <span className="check-mark">✓</span>}
                        </button>
                    ))}
                </div>
            </section>

            {/* Article Detail Modal */}
            {selectedPost && (
                <div className="article-modal-overlay" onClick={() => setSelectedPost(null)}>
                    <div className="article-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="article-modal-header">
                            <h2>{selectedPost.title}</h2>
                            <div className="modal-actions">
                                <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                        const text = `${selectedPost.title}\n\n${selectedPost.content}\n\nTopics: ${(selectedPost.topics || []).join(', ')}`;
                                        handleCopy(text, e);
                                    }}
                                    title="Copy article"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginRight: '8px' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button className="close-btn" onClick={() => setSelectedPost(null)}>✕</button>
                            </div>
                        </div>
                        <div className="article-modal-body">
                            <div
                                className="article-content"
                                style={{ fontSize: `${settings.fontSize}px` }}
                                dangerouslySetInnerHTML={{ __html: formatContent(selectedPost.content) }}
                            />
                            {selectedPost.scripture_refs && selectedPost.scripture_refs.length > 0 && (
                                <div className="scripture-refs">
                                    <h4>{t.scriptureRefs}</h4>
                                    <div className="refs-list">
                                        {selectedPost.scripture_refs.map((ref, idx) => (
                                            <span
                                                key={idx}
                                                className="scripture-ref clickable"
                                                onClick={(e) => handleScriptureClick(ref, e)}
                                            >
                                                {ref}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="article-topics">
                                {(selectedPost.topics || []).map((topic, idx) => (
                                    <span key={idx} className="topic-chip">{topic}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Blog;
