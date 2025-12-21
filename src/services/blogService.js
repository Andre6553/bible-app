import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';
import { logApiCall } from './adminService';

/**
 * Blog Service - Handles personalized content and AI devotionals
 */

// =====================================================
// Devotional History Tracking (Prevents Repetition)
// =====================================================

/**
 * Get user's recent devotional history (last 365 days = 1 year)
 */
const getRecentDevotionalHistory = async (userId) => {
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);

        const { data, error } = await supabase
            .from('devotional_history')
            .select('theme, scripture_ref, title_hash')
            .eq('user_id', userId)
            .gte('created_at', oneYearAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Could not fetch devotional history:', error);
            return { themes: [], scriptures: [], hashes: [] };
        }

        return {
            themes: [...new Set(data.map(d => d.theme).filter(Boolean))],
            scriptures: [...new Set(data.map(d => d.scripture_ref).filter(Boolean))],
            hashes: data.map(d => d.title_hash).filter(Boolean)
        };
    } catch (err) {
        console.error('Error getting devotional history:', err);
        return { themes: [], scriptures: [], hashes: [] };
    }
};

/**
 * Save devotional to history
 */
const saveDevotionalToHistory = async (userId, theme, scriptureRef, title) => {
    try {
        const titleHash = title ? simpleHash(title) : null;

        await supabase
            .from('devotional_history')
            .upsert({
                user_id: userId,
                generated_date: new Date().toISOString().split('T')[0],
                theme: theme,
                scripture_ref: scriptureRef,
                title_hash: titleHash
            }, {
                onConflict: 'user_id,generated_date,theme'
            });
    } catch (err) {
        console.warn('Could not save to devotional history:', err);
    }
};

/**
 * Simple hash function for content comparison
 */
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
};

/**
 * Get topics that haven't been used recently
 */
const getUnusedTopics = async (userId, allTopics) => {
    const history = await getRecentDevotionalHistory(userId);
    const recentThemes = history.themes;

    // Filter out recently used topics
    const unusedTopics = allTopics.filter(t => !recentThemes.includes(t.topic));

    // If all topics have been used, return the least recently used ones
    if (unusedTopics.length === 0) {
        return allTopics.slice(0, 3);
    }

    return unusedTopics;
};

/**
 * Get diverse prompt angle based on day, season, and randomness
 */
const getDiversePromptAngle = (language = 'en') => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();
    const dayOfWeek = now.getDay();

    // Check for special seasons/holidays
    const seasonalContext = getSeasonalContext(month, day, language);

    const baseAngles = [
        'practical daily application with a specific action step',
        'deep encouragement for someone facing challenges',
        'gratitude and thanksgiving with reflection questions',
        'a gentle challenge to grow in faith',
        'comfort and peace for anxious hearts',
        'wisdom for making decisions',
        'joy and celebration of God\'s goodness',
        'perseverance and strength in difficult times'
    ];

    const randomIndex = Math.floor(Math.random() * baseAngles.length);
    const baseAngle = baseAngles[(dayOfWeek + randomIndex) % baseAngles.length];

    // Combine base angle with seasonal context
    if (seasonalContext) {
        return `${baseAngle}, with themes appropriate for ${seasonalContext}`;
    }

    return baseAngle;
};

/**
 * Get seasonal context based on current date
 */
const getSeasonalContext = (month, day, language = 'en') => {
    // Christmas Season (Dec 1-31)
    if (month === 11) {
        if (day >= 24 && day <= 26) return language === 'af' ? 'Kersdag vieringe' : 'Christmas Day celebrations';

        // Only include Advent/Christmas prep ~30% of the time to vary content
        if (Math.random() > 0.7) {
            if (day >= 1 && day <= 23) {
                return language === 'af'
                    ? 'die Kersfeestyd van afwagting en hoop'
                    : 'Christmas Time and the anticipation of Jesus\' birth';
            }
            if (day >= 27) {
                return language === 'af'
                    ? 'die Kerstyd van dankbaarheid'
                    : 'the Christmas season of gratitude and new beginnings';
            }
        }
    }

    // New Year (Dec 31 - Jan 7)
    if ((month === 11 && day === 31) || (month === 0 && day <= 7)) {
        return 'New Year - fresh starts, reflection, and purpose';
    }

    // Easter season (approximate - March/April)
    if (month === 2 || month === 3) {
        if (month === 2) return 'the Lenten season of reflection and preparation';
        if (month === 3 && day <= 21) return 'the Easter season of resurrection and new life';
    }

    // Thanksgiving (November)
    if (month === 10 && day >= 20 && day <= 30) {
        return 'the season of Thanksgiving and gratitude';
    }

    // Mother's Day / Father's Day (May/June)
    if (month === 4 && day >= 8 && day <= 14) return 'honoring mothers and family';
    if (month === 5 && day >= 15 && day <= 21) return 'honoring fathers and family';

    // Fall/Back to school (September)
    if (month === 8) return 'new beginnings and transitions';

    return null; // No special season
};

/**
 * Get instruction to avoid recent scriptures
 */
const getScriptureAvoidanceInstruction = (recentScriptures) => {
    if (recentScriptures.length === 0) return '';

    const scriptureList = recentScriptures.slice(0, 10).join(', ');
    return `\n\nIMPORTANT: Please choose a DIFFERENT scripture. Avoid these recently used ones: ${scriptureList}`;
};

// =====================================================
// App Settings
// =====================================================

/**
 * Check if blog rate limiting is enabled
 */
export const isRateLimitEnabled = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'blog_rate_limit_enabled')
            .single();

        if (error) {
            console.warn('Could not fetch rate limit setting:', error);
            return false; // Default to OFF if can't read
        }

        return data?.value === 'true';
    } catch (err) {
        console.error('Error checking rate limit:', err);
        return false;
    }
};

/**
 * Toggle the blog rate limit setting (admin only)
 */
export const toggleRateLimit = async (enabled) => {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'blog_rate_limit_enabled',
                value: enabled ? 'true' : 'false',
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error toggling rate limit:', err);
        return { success: false, error: err.message };
    }
};

// =====================================================
// User Interests
// =====================================================

/**
 * Extract topics from user's search history
 */
export const analyzeUserInterests = async (userId) => {
    try {
        // Get user's recent searches
        const { data: searches, error: searchError } = await supabase
            .from('search_logs')
            .select('query')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (searchError) throw searchError;

        // Get user's AI questions
        const { data: questions, error: questionsError } = await supabase
            .from('ai_questions')
            .select('question')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (questionsError) throw questionsError;

        // Combine and extract common topics
        const allText = [
            ...(searches || []).map(s => s.query),
            ...(questions || []).map(q => q.question)
        ].join(' ').toLowerCase();

        // Common Bible topics (Bilingual Support: English & Afrikaans)
        const topicKeywords = {
            'love': ['love', 'loving', 'loved', 'beloved', 'liefde', 'lief'],
            'faith': ['faith', 'believe', 'believing', 'trust', 'geloof', 'glo'],
            'prayer': ['prayer', 'pray', 'praying', 'gebed', 'bid'],
            'forgiveness': ['forgive', 'forgiveness', 'forgiving', 'pardon', 'vergewe', 'vergifnis'],
            'peace': ['peace', 'peaceful', 'calm', 'anxiety', 'worry', 'vrede', 'rustigheid'],
            'hope': ['hope', 'hoping', 'hopeful', 'hoop'],
            'grace': ['grace', 'gracious', 'mercy', 'genade', 'barmhartigheid'],
            'salvation': ['salvation', 'saved', 'saving', 'eternal life', 'redding', 'saligheid'],
            'healing': ['healing', 'heal', 'healed', 'health', 'genesing', 'genees'],
            'wisdom': ['wisdom', 'wise', 'understanding', 'wysheid', 'verstand'],
            'strength': ['strength', 'strong', 'power', 'courage', 'sterkte', 'krag', 'moed'],
            'joy': ['joy', 'joyful', 'happiness', 'happy', 'vreugde', 'blydskap'],
            'family': ['family', 'marriage', 'children', 'parents', 'familie', 'gesin', 'huwelik'],
            'fear': ['fear', 'afraid', 'scared', 'anxiety', 'vrees', 'bang'],
            'purpose': ['purpose', 'calling', 'meant', 'plan', 'doel', 'roeping']
        };

        const foundTopics = {};
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            const count = keywords.reduce((acc, kw) => {
                const regex = new RegExp(`\\b${kw}\\b`, 'gi');
                const matches = allText.match(regex);
                return acc + (matches ? matches.length : 0);
            }, 0);

            if (count > 0) {
                foundTopics[topic] = count;
            }
        }

        // Generic Fallback: Extract frequent words if few topics are found
        if (Object.keys(foundTopics).length < 2) {
            const stopWords = new Set(['bible', 'verse', 'chapter', 'what', 'does', 'say', 'about', 'the', 'and', 'for', 'die', 'van', 'vanuit', 'oor', 'hoe', 'waar', 'wat', 'is', 'om', 'te', 'met', 'by', 'aan']);
            const words = allText.split(/[\s,?.!]+/)
                .filter(w => w.length > 4 && !stopWords.has(w) && !w.startsWith('/'));

            const wordCounts = {};
            words.forEach(w => wordCounts[w] = (wordCounts[w] || 0) + 1);

            Object.entries(wordCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .forEach(([word, count]) => {
                    if (!foundTopics[word]) foundTopics[word] = count;
                });
        }

        // Sort by frequency
        const sortedTopics = Object.entries(foundTopics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6) // Increased to 6 for better variety
            .map(([topic, weight]) => ({
                topic: topic.charAt(0).toUpperCase() + topic.slice(1),
                weight
            }));

        return { success: true, topics: sortedTopics };
    } catch (err) {
        console.error('Error analyzing user interests:', err);
        return { success: false, topics: [], error: err.message };
    }
};

/**
 * Get saved user keyword preferences from database
 */
export const getKeywordPreferences = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', `keyword_prefs_${userId}`)
            .single();

        if (error || !data) return { highlighted: {}, used: [] };
        return JSON.parse(data.value);
    } catch (err) {
        return { highlighted: {}, used: [] };
    }
};

/**
 * Save user keyword preferences to database
 */
export const saveKeywordPreferences = async (userId, prefs) => {
    try {
        await supabase
            .from('app_settings')
            .upsert({
                key: `keyword_prefs_${userId}`,
                value: JSON.stringify(prefs),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        return { success: true };
    } catch (err) {
        console.error('Error saving keyword prefs:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Extract last 50 unique search words, merged with defaults
 */
export const getSearchKeywords = async (userId) => {
    try {
        // 1. Get recent searches
        const { data: searches } = await supabase
            .from('search_logs')
            .select('query')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        const STOP_WORDS = new Set(['BIBLE', 'VERSE', 'CHAPTER', 'WHAT', 'DOES', 'SAY', 'ABOUT', 'THE', 'AND', 'FOR', 'DIE', 'VAN', 'VANUIT', 'OOR', 'HOE', 'WAAR', 'WAT', 'IS', 'OM', 'TE', 'MET', 'BY', 'AAN', 'THIS', 'THAT', 'WITH', 'FROM']);
        const DEFAULTS = ['Faith', 'Hope', 'Love', 'Grace', 'Patience', 'Prayer'];

        let words = [];
        if (searches && searches.length > 0) {
            const allText = searches.map(s => s.query).join(' ').toUpperCase();
            words = [...new Set(allText.split(/[\s,?.!]+/)
                .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !w.startsWith('/')))]
                .slice(0, 50)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        }

        // Merge with defaults if empty or few
        const finalWords = [...new Set([...words, ...DEFAULTS])].slice(0, 50);

        // 2. Map with highlight status from preferences
        const prefs = await getKeywordPreferences(userId);

        return finalWords.map(word => ({
            word,
            isHighlighted: prefs.highlighted[word] !== false // Default to true for new words
        }));
    } catch (err) {
        console.error('Error getting search keywords:', err);
        return [];
    }
};

/**
 * Toggle highlight status of a keyword
 */
export const toggleKeywordHighlight = async (userId, word, isHighlighted) => {
    const prefs = await getKeywordPreferences(userId);
    prefs.highlighted[word] = isHighlighted;
    return await saveKeywordPreferences(userId, prefs);
};

/**
 * Pick 2 topics for generation using rotation logic
 */
export const pickTopicsForGeneration = async (userId) => {
    const keywords = await getSearchKeywords(userId);
    const highlighted = keywords.filter(k => k.isHighlighted).map(k => k.word);

    if (highlighted.length === 0) {
        return ['Faith', 'Hope']; // Absolute fallback
    }

    const prefs = await getKeywordPreferences(userId);
    const used = prefs.used || [];

    // Filter out already used ones
    let available = highlighted.filter(h => !used.includes(h));

    // Reset if all have been used
    if (available.length < 2) {
        prefs.used = [];
        available = highlighted;
    }

    // Shuffle and pick 2
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 2);

    // Update used list
    prefs.used = [...new Set([...used, ...picked])];
    await saveKeywordPreferences(userId, prefs);

    return picked;
};
export const getUserInterests = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('user_interests')
            .select('topic, weight')
            .eq('user_id', userId)
            .order('weight', { ascending: false })
            .limit(10);

        if (error) throw error;
        return { success: true, interests: data || [] };
    } catch (err) {
        console.error('Error getting user interests:', err);
        return { success: false, interests: [], error: err.message };
    }
};

// =====================================================
// Blog Posts
// =====================================================

/**
 * Get all curated blog posts
 */
export const getAllPosts = async () => {
    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, posts: data || [] };
    } catch (err) {
        console.error('Error fetching blog posts:', err);
        return { success: false, posts: [], error: err.message };
    }
};

// =====================================================
// Super User Management
// =====================================================

// Default super users (used if database is empty)
const DEFAULT_SUPER_USERS = [
    'user_fvxru9myd_1765726153295',
    'user_os3n3v0hn_1765725853758'
];

/**
 * Get list of super users from database
 */
export const getSuperUsers = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'super_users')
            .single();

        if (error || !data) {
            // Return defaults if not set
            return DEFAULT_SUPER_USERS;
        }

        return JSON.parse(data.value);
    } catch (err) {
        console.error('Error getting super users:', err);
        return DEFAULT_SUPER_USERS;
    }
};

/**
 * Add a user to super users list
 */
export const addSuperUser = async (userId) => {
    try {
        const currentUsers = await getSuperUsers();
        if (currentUsers.includes(userId)) {
            return { success: true, message: 'User is already a super user' };
        }

        const newList = [...currentUsers, userId];

        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'super_users',
                value: JSON.stringify(newList),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'key'
            });

        if (error) throw error;

        console.log('✅ Added super user:', userId);
        return { success: true };
    } catch (err) {
        console.error('Error adding super user:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Remove a user from super users list
 */
export const removeSuperUser = async (userId) => {
    try {
        const currentUsers = await getSuperUsers();
        const newList = currentUsers.filter(id => id !== userId);

        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'super_users',
                value: JSON.stringify(newList),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'key'
            });

        if (error) throw error;

        console.log('✅ Removed super user:', userId);
        return { success: true };
    } catch (err) {
        console.error('Error removing super user:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Check if a user is a super user (bypasses rate limits)
 */
export const isSuperUser = async (userId) => {
    const superUsers = await getSuperUsers();
    return superUsers.includes(userId);
};

/**
 * Get cache expiry time based on rate limit setting
 * Rate limit OFF: 1 hour
 * Rate limit ON: 24 hours
 */
const getCacheExpiryMs = async () => {
    const rateLimited = await isRateLimitEnabled();
    return rateLimited
        ? 24 * 60 * 60 * 1000  // 24 hours
        : 60 * 60 * 1000;      // 1 hour
};

/**
 * Check if cached content is still valid
 */
const isCacheValid = (lastRefresh, expiryMs) => {
    if (!lastRefresh) return false;
    const elapsed = Date.now() - new Date(lastRefresh).getTime();
    return elapsed < expiryMs;
};

/**
 * Check refresh cooldown status for UI display
 * Returns { canRefresh, remainingMinutes, message }
 * Super users always bypass cooldown
 */
export const checkRefreshCooldown = async (userId) => {
    try {
        // Super users always bypass rate limits
        const isSuper = await isSuperUser(userId);
        console.log(`Checking cooldown for ${userId}. Super User: ${isSuper}`);

        if (isSuper) {
            console.log('🔓 Super user detected - bypassing rate limit');
            return { canRefresh: true, remainingMinutes: 0, message: null };
        }

        const expiryMs = await getCacheExpiryMs();
        const rateLimited = await isRateLimitEnabled();

        const { data: cached } = await supabase
            .from('user_devotionals')
            .select('last_refresh')
            .eq('user_id', userId)
            .order('last_refresh', { ascending: false })
            .limit(1)
            .single();

        if (!cached?.last_refresh) {
            return { canRefresh: true, remainingMinutes: 0, message: null };
        }

        const elapsed = Date.now() - new Date(cached.last_refresh).getTime();
        const remaining = expiryMs - elapsed;

        if (remaining <= 0) {
            return { canRefresh: true, remainingMinutes: 0, message: null };
        }

        const remainingMinutes = Math.ceil(remaining / (60 * 1000));
        const remainingHours = Math.floor(remainingMinutes / 60);

        let message;
        if (rateLimited) {
            message = remainingHours > 0
                ? `Can only refresh once per day. Refreshes in ${remainingHours}h ${remainingMinutes % 60}m`
                : `Can only refresh once per day. Refreshes in ${remainingMinutes} minutes`;
        } else {
            message = `Can only refresh once every hour. Refreshes in ${remainingMinutes} minutes`;
        }

        return { canRefresh: false, remainingMinutes, message };
    } catch (err) {
        console.error('Error checking cooldown:', err);
        return { canRefresh: true, remainingMinutes: 0, message: null };
    }
};

/**
 * Get recommended posts - uses caching with time-based expiry
 * Rate limit OFF: refresh every 1 hour
 * Rate limit ON: refresh every 24 hours
 * forceGenerate: always generate fresh content (New button)
 */
export const getRecommendedPosts = async (userId, forceGenerate = false, language = 'en') => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const expiryMs = await getCacheExpiryMs();

        // Check for cached content if not forcing fresh generation
        // Note: For simplicity, we only cache English content for now or assume cache matches current desire.
        // Ideally we should check if cached content matches requested language.
        // For now, if language is not English, we maybe shouldn't use cache or we assume cache is mixed?
        // Better: Check if we have language metadata. Since we don't, let's assume cache is only valid if we are not strict or just force gen for now 
        // if user switches freq. 
        // Let's pass language to generateFreshArticle either way.
        if (!forceGenerate) {
            const { data: cached, error: cacheError } = await supabase
                .from('user_devotionals')
                .select('recommended_articles, last_refresh')
                .eq('user_id', userId)
                .order('last_refresh', { ascending: false })
                .limit(1)
                .single();

            // Return cached articles if valid
            if (!cacheError && cached?.recommended_articles && cached?.last_refresh) {
                if (isCacheValid(cached.last_refresh, expiryMs)) {
                    console.log('Returning cached recommended articles');
                    return {
                        success: true,
                        posts: cached.recommended_articles,
                        personalized: true,
                        cached: true
                    };
                }
            }
        }

        // Generate 2 fresh AI articles with history awareness and keyword rotation
        const history = await getRecentDevotionalHistory(userId);
        const finalTopics = await pickTopicsForGeneration(userId);

        const articles = await Promise.all(
            finalTopics.slice(0, 2).map(async (topic, index) => {
                const article = await generateFreshArticle(topic, index, history.scriptures, language);
                // Save to history for variety tracking
                if (article) {
                    await saveDevotionalToHistory(userId, topic, article.scripture_refs?.[0], article.title);
                }
                return article;
            })
        );

        const successfulArticles = articles.filter(a => a !== null);

        // Save to cache - try update first, then insert if needed
        const now = new Date().toISOString();

        // First try to update existing row
        const { data: updateResult, error: updateError } = await supabase
            .from('user_devotionals')
            .update({
                recommended_articles: successfulArticles,
                last_refresh: now
            })
            .eq('user_id', userId)
            .eq('generated_date', today)
            .select();

        // If no row exists to update, insert a new one with placeholder content
        if (!updateResult || updateResult.length === 0) {
            const { error: insertError } = await supabase
                .from('user_devotionals')
                .insert({
                    user_id: userId,
                    generated_date: today,
                    title: 'Pending',
                    content: 'Devotional pending generation',
                    topics: finalTopics,
                    recommended_articles: successfulArticles,
                    last_refresh: now
                });

            if (insertError) {
                console.warn('Could not save article cache:', insertError);
            }
        }

        return {
            success: true,
            posts: successfulArticles,
            personalized: finalTopics.length > 0,
            cached: false
        };
    } catch (err) {
        console.error('Error getting recommended posts:', err);
        return { success: false, error: 'Could not generate content. Please try again.' };
    }
};

/**
 * Generate a fresh article on a specific topic
 * Now includes diverse angles, seasonal context, and scripture avoidance
 */
const generateFreshArticle = async (topic, index = 0, recentScriptures = [], language = 'en') => {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Get diverse angle with seasonal awareness
        const angle = getDiversePromptAngle(language);
        const scriptureAvoidance = getScriptureAvoidanceInstruction(recentScriptures);

        // Language instruction
        const isAf = language === 'af';
        const langInstruction = isAf
            ? `\n\nIMPORTANT: Write the entire article in Afrikaans. For any scripture references, accurate Afrikaans text from the 1983 Vertaling (AFR83) or 1953 Vertaling (AFR53) MUST be used.`
            : '';

        const langPrefix = isAf ? 'SKRYF IN AFRIKAANS. ' : '';

        const prompt = `${langPrefix}Write a short, inspiring Bible article (150-200 words) about "${topic}" with focus on: ${angle}.

Requirements:
- ${isAf ? 'Write in Afrikaans' : 'Write in English'}
- Start with an engaging opening line
- Include 1-2 relevant scripture references in **bold** format like **John 3:16**
- Keep it practical and encouraging
- End with a thought-provoking question or call to action
- Do NOT include a title - just the content

Tone: Warm, friendly, accessible - like a conversation with a wise friend.${scriptureAvoidance}${langInstruction}`;

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        // Log successful API call
        logApiCall('generateFreshArticle', 'success', 'gemini-2.0-flash', { topic, language });

        // Generate title
        const titlePrompt = `Create a catchy, engaging title (4-7 words) for an article about ${topic}. Return ONLY the title, no quotes.${language === 'af' ? ' Write in Afrikaans.' : ''}`;
        const titleResult = await model.generateContent(titlePrompt);
        const title = titleResult.response.text().trim().replace(/['"]/g, '');

        // Generate summary
        const summary = content.substring(0, 120).replace(/\*\*/g, '').trim() + '...';

        return {
            id: `ai-${Date.now()}-${index}`,
            title: title,
            content: content,
            summary: summary,
            topics: [topic],
            scripture_refs: extractScriptureRefs(content),
            is_generated: true,
            view_count: 0
        };
    } catch (err) {
        console.error(`Error generating article for topic "${topic}":`, err);
        logApiCall('generateFreshArticle', 'error', 'gemini-2.0-flash', { topic, error: err.message });
        return null;
    }
};

/**
 * Extract scripture references from text (e.g., **John 3:16**)
 */
const extractScriptureRefs = (text) => {
    const matches = text.match(/\*\*([^*]+\d+:\d+[^*]*)\*\*/g) || [];
    return matches.map(m => m.replace(/\*\*/g, '').trim()).slice(0, 3);
};

/**
 * Get a single post by ID
 */
export const getPostById = async (id) => {
    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Increment view count
        await supabase
            .from('blog_posts')
            .update({ view_count: (data.view_count || 0) + 1 })
            .eq('id', id);

        return { success: true, post: data };
    } catch (err) {
        console.error('Error fetching post:', err);
        return { success: false, post: null, error: err.message };
    }
};

// =====================================================
// AI Devotionals
// =====================================================

/**
 * Get or generate today's devotional for a user
 * Uses time-based caching: 1 hour (rate limit OFF) or 24 hours (rate limit ON)
 */
export const getDailyDevotional = async (userId, forceGenerate = false, language = 'en') => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const expiryMs = await getCacheExpiryMs();

        // Check for cached devotional if not forcing fresh generation
        if (!forceGenerate) {
            const { data: existing, error: existingError } = await supabase
                .from('user_devotionals')
                .select('*')
                .eq('user_id', userId)
                .order('last_refresh', { ascending: false })
                .limit(1)
                .single();

            // Return cached if valid
            if (!existingError && existing && existing.content && existing.last_refresh) {
                if (isCacheValid(existing.last_refresh, expiryMs)) {
                    console.log('Returning cached devotional');
                    return {
                        success: true,
                        devotional: existing,
                        cached: true,
                        message: expiryMs > 60 * 60 * 1000
                            ? 'Showing your daily devotional (limit: 1/day)'
                            : 'Showing cached devotional (refreshes hourly)'
                    };
                }
            }
        }

        // Analyze user's interests for personalization
        const { topics } = await analyzeUserInterests(userId);

        // Get history to avoid repetition
        const history = await getRecentDevotionalHistory(userId);

        // Get unused topics (rotate through interests)
        const availableTopics = topics.length > 0 ? topics : [
            { topic: 'faith' }, { topic: 'hope' }, { topic: 'love' },
            { topic: 'peace' }, { topic: 'joy' }, { topic: 'grace' }
        ];
        const unusedTopics = await getUnusedTopics(userId, availableTopics);
        const devotionalTopics = unusedTopics.slice(0, 3).map(t => t.topic || t);

        // If no topics available, use seasonal defaults
        const finalTopics = devotionalTopics.length > 0
            ? devotionalTopics
            : ['faith', 'hope', 'love'];

        // Generate new devotional using AI (with scripture avoidance)
        const devotionalContent = await generateDevotionalWithAI(finalTopics, history.scriptures, language);

        if (!devotionalContent.success) {
            return { success: false, error: devotionalContent.error };
        }

        // Save to history (prevents repetition in future)
        const mainTopic = finalTopics[0];
        await saveDevotionalToHistory(
            userId,
            mainTopic,
            devotionalContent.scriptureRef,
            devotionalContent.title
        );

        // Save to database with timestamp
        const { data: saved, error: saveError } = await supabase
            .from('user_devotionals')
            .upsert({
                user_id: userId,
                title: devotionalContent.title,
                content: devotionalContent.content,
                topics: finalTopics,
                generated_date: today,
                last_refresh: new Date().toISOString()
            }, {
                onConflict: 'user_id,generated_date'
            })
            .select()
            .single();

        if (saveError) {
            console.warn('Could not save devotional:', saveError);
        }

        return {
            success: true,
            devotional: saved || devotionalContent,
            cached: false,
            topics: devotionalTopics
        };
    } catch (err) {
        console.error('Error getting daily devotional:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Generate devotional content using Gemini AI
 * Now includes diverse angles and scripture avoidance
 */
const generateDevotionalWithAI = async (topics, recentScriptures = [], language = 'en') => {
    try {
        // Import the AI module dynamically to avoid circular dependencies
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

        const topicList = topics.join(', ');
        const angle = getDiversePromptAngle(language);
        const scriptureAvoidance = getScriptureAvoidanceInstruction(recentScriptures);

        // Language instruction
        const isAf = language === 'af';
        const langInstruction = isAf
            ? `\n\nIMPORTANT: Write the entire devotional in Afrikaans. Use proper Afrikaans grammar. For any scripture references, you MUST use the accurate text from the Afrikaans 1983 Vertaling (AFR83) or 1953 Vertaling (AFR53).`
            : '';

        const langPrefix = isAf ? 'SKRYF IN AFRIKAANS. ' : '';

        const prompt = `${langPrefix}You are a warm, encouraging Bible teacher. Write a short daily devotional (250-350 words) focused on: ${topicList}.

Today's focus should be on: ${angle}

Structure:
1. Opening thought (1-2 sentences connecting to daily life)
2. Scripture verse (choose ONE relevant verse, quote it fully)
3. Reflection (explain the verse and how it applies to the topics)
4. Practical application (one specific thing the reader can do today)
5. Closing prayer (2-3 sentences)

Requirements:
- ${isAf ? 'Write in Afrikaans' : 'Write in English'}
- Format the scripture reference as **Book Chapter:Verse** in bold.
- Keep the tone warm, personal, and encouraging - like a friend sharing wisdom.
- Do not use overly formal or preachy language.
- Do NOT start with greetings like "Hey Friend", "Okay Friend", "Hello", etc. - just begin directly with the content.${scriptureAvoidance}${langInstruction}`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        // Log successful API call
        logApiCall('generateDevotionalWithAI', 'success', 'gemini-2.0-flash', { topics: topicList });

        // Extract scripture reference from content
        const scriptureMatch = content.match(/\*\*([^*]+)\*\*/);
        const scriptureRef = scriptureMatch ? scriptureMatch[1] : null;

        // Generate a title based on topics
        const titlePrompt = `Create a short, engaging title (5-8 words max) for a devotional about: ${topicList}. Return ONLY the title, no quotes or formatting.${language === 'af' ? ' Write in Afrikaans.' : ''}`;
        const titleResult = await model.generateContent(titlePrompt);
        const title = titleResult.response.text().trim().replace(/['"]/g, '');

        return {
            success: true,
            title: title,
            content: content,
            scriptureRef: scriptureRef
        };
    } catch (err) {
        console.error('Error generating devotional with AI:', err);
        logApiCall('generateDevotionalWithAI', 'error', 'gemini-2.0-flash', { error: err.message });
        return {
            success: false,
            error: 'Could not generate devotional. Please try again later.'
        };
    }
};



/**
 * Get trending topics across all users
 */
export const getTrendingTopics = async () => {
    try {
        // Get most common search terms from recent searches
        const { data, error } = await supabase
            .from('search_logs')
            .select('query')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        // Count topic occurrences (Bilingual Support)
        const topicKeywords = {
            'love': ['love', 'liefde'],
            'faith': ['faith', 'geloof'],
            'prayer': ['prayer', 'gebed'],
            'forgiveness': ['forgive', 'vergewe'],
            'peace': ['peace', 'vrede'],
            'hope': ['hope', 'hoop'],
            'grace': ['grace', 'genade'],
            'healing': ['healing', 'genesing'],
            'wisdom': ['wisdom', 'wysheid'],
            'strength': ['strength', 'krag']
        };

        const counts = {};

        (data || []).forEach(item => {
            const query = item.query.toLowerCase();
            for (const [topic, keywords] of Object.entries(topicKeywords)) {
                if (keywords.some(kw => query.includes(kw))) {
                    counts[topic] = (counts[topic] || 0) + 1;
                }
            }
        });

        const trending = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, count]) => ({
                topic: topic.charAt(0).toUpperCase() + topic.slice(1),
                count
            }));

        return { success: true, topics: trending };
    } catch (err) {
        console.error('Error getting trending topics:', err);
        return { success: false, topics: [] };
    }
};
