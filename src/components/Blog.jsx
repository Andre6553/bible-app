import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserId, getBooks } from '../services/bibleService';
import {
    getRecommendedPosts,
    getDailyDevotional,
    getTrendingTopics,
    analyzeUserInterests,
    checkRefreshCooldown
} from '../services/blogService';
import { useSettings } from '../context/SettingsContext';
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
            noDevotional: 'No devotional yet. Click "New" to generate one!',
            noArticles: 'No articles yet. Start searching to get personalized recommendations!',
            scriptureRefs: '📖 Scripture References',
            tryAgain: 'Try Again',
            loading: 'Could not load content. Please try again.'
        },
        af: {
            title: '✨ Vir Jou',
            subtitle: 'Gepersonaliseerde inhoud gebaseer op jou belangstellings',
            todaysInspiration: '🌅 Vandag se Inspirasie',
            newBtn: 'Nuut',
            yourTopics: '🎯 Jou Onderwerpe',
            topicsDesc: 'Gebaseer op jou soektogte en vrae',
            trending: '🔥 Gewilde Onderwerpe',
            recommended: '📚 Aanbevole Leesstof',
            noDevotional: 'Geen dagstukkie nog nie. Kliek "Nuut" om een te genereer!',
            noArticles: 'Geen artikels nie. Begin soek om aanbevelings te kry!',
            scriptureRefs: '📖 Skrifverwysings',
            tryAgain: 'Probeer Weer',
            loading: 'Kon nie inhoud laai nie. Probeer asseblief weer.'
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
            const userId = getUserId();

            // Load all content
            const [postsResult, devotionalResult, trendingResult, interestsResult] = await Promise.all([
                getRecommendedPosts(userId, forceRefesh, settings.language),
                getDailyDevotional(userId, forceRefesh, settings.language),
                getTrendingTopics(),
                analyzeUserInterests(userId)
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
        } catch (err) {
            console.error('Error loading blog content:', err);
            setError('Could not load content. Please try again.');
        }

        setLoading(false);
    };

    const refreshDevotional = async () => {
        const userId = getUserId();

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
            alert(translations[settings.language].loading || 'Could not generate content');
        }
        setDevotionalLoading(false);
    };

    const refreshPosts = async () => {
        const userId = getUserId();

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
            alert(translations[settings.language].loading || 'Could not generate content');
        }
        setPostsLoading(false);
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
            // Parse reference: "Matthew 6:9-13" or "1 Samuel 17:4"
            // Find the last space to separate book from chapter:verse
            const lastSpaceIndex = ref.lastIndexOf(' ');
            if (lastSpaceIndex === -1) {
                // Fallback to search if can't parse
                navigate(`/search?q=${encodeURIComponent(ref)}`);
                return;
            }

            const bookName = ref.substring(0, lastSpaceIndex).trim();
            const refPart = ref.substring(lastSpaceIndex + 1).trim(); // "6:9-13" or "3:16"

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
                const bookId = String(b.id).toLowerCase();
                return dbName === targetName || bookId === bookName.toLowerCase();
            });

            // Fallback: partial match
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
                        <h3>{devotional.title || 'Daily Devotional'}</h3>
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
            {userTopics.length > 0 && (
                <section className="blog-section topics-section">
                    <h2>{t.yourTopics}</h2>
                    <p className="section-desc">{t.topicsDesc}</p>
                    <div className="topics-grid">
                        {userTopics.map((item, idx) => (
                            <div key={idx} className="topic-card">
                                <span className="topic-name">{item.topic}</span>
                                <span className="topic-weight">{item.weight} searches</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

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

            {/* Article Detail Modal */}
            {selectedPost && (
                <div className="article-modal-overlay" onClick={() => setSelectedPost(null)}>
                    <div className="article-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="article-modal-header">
                            <h2>{selectedPost.title}</h2>
                            <button className="close-btn" onClick={() => setSelectedPost(null)}>✕</button>
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
