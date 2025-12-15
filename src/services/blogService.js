import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';

/**
 * Blog Service - Handles personalized content and AI devotionals
 */

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

        // Common Bible topics to look for
        const topicKeywords = {
            'love': ['love', 'loving', 'loved', 'beloved'],
            'faith': ['faith', 'believe', 'believing', 'trust'],
            'prayer': ['prayer', 'pray', 'praying'],
            'forgiveness': ['forgive', 'forgiveness', 'forgiving', 'pardon'],
            'peace': ['peace', 'peaceful', 'calm', 'anxiety', 'worry'],
            'hope': ['hope', 'hoping', 'hopeful'],
            'grace': ['grace', 'gracious', 'mercy'],
            'salvation': ['salvation', 'saved', 'saving', 'eternal life'],
            'healing': ['healing', 'heal', 'healed', 'health'],
            'wisdom': ['wisdom', 'wise', 'understanding'],
            'strength': ['strength', 'strong', 'power', 'courage'],
            'joy': ['joy', 'joyful', 'happiness', 'happy'],
            'family': ['family', 'marriage', 'children', 'parents'],
            'fear': ['fear', 'afraid', 'scared', 'anxiety'],
            'purpose': ['purpose', 'calling', 'meant', 'plan']
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

        // Sort by frequency
        const sortedTopics = Object.entries(foundTopics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, weight]) => ({ topic, weight }));

        return { success: true, topics: sortedTopics };
    } catch (err) {
        console.error('Error analyzing user interests:', err);
        return { success: false, topics: [], error: err.message };
    }
};

/**
 * Get saved user interests from database
 */
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
        if (await isSuperUser(userId)) {
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
export const getRecommendedPosts = async (userId, forceGenerate = false) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const expiryMs = await getCacheExpiryMs();

        // Check for cached content if not forcing fresh generation
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

        // Generate fresh articles
        console.log('Generating fresh recommended articles...');
        const { topics } = await analyzeUserInterests(userId);
        const userTopics = topics.map(t => t.topic);

        const articleTopics = userTopics.length > 0
            ? userTopics.slice(0, 3)
            : ['faith', 'love', 'hope'];

        // Generate 2 fresh AI articles
        const articles = await Promise.all(
            articleTopics.slice(0, 2).map(async (topic, index) => {
                const article = await generateFreshArticle(topic, index);
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
                    topics: articleTopics,
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
            personalized: userTopics.length > 0,
            cached: false
        };
    } catch (err) {
        console.error('Error getting recommended posts:', err);
        return getAllPosts();
    }
};

/**
 * Generate a fresh article on a specific topic
 */
const generateFreshArticle = async (topic, index = 0) => {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Vary the angle based on index for diversity
        const angles = [
            'practical daily application',
            'deep biblical understanding',
            'encouragement and hope'
        ];
        const angle = angles[index % angles.length];

        const prompt = `Write a short, inspiring Bible article (150-200 words) about "${topic}" focusing on ${angle}.

Requirements:
- Start with an engaging opening line
- Include 1-2 relevant scripture references in **bold** format like **John 3:16**
- Keep it practical and encouraging
- End with a thought-provoking question or call to action
- Do NOT include a title - just the content

Tone: Warm, friendly, accessible - like a conversation with a wise friend.`;

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        // Generate title
        const titlePrompt = `Create a catchy, engaging title (4-7 words) for an article about ${topic}. Return ONLY the title, no quotes.`;
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
export const getDailyDevotional = async (userId, forceGenerate = false) => {
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
        const topTopics = topics.slice(0, 3).map(t => t.topic);

        // If no topics, use defaults
        const devotionalTopics = topTopics.length > 0
            ? topTopics
            : ['faith', 'hope', 'love'];

        // Generate new devotional using AI
        const devotionalContent = await generateDevotionalWithAI(devotionalTopics);

        if (!devotionalContent.success) {
            return { success: false, error: devotionalContent.error };
        }

        // Save to database with timestamp
        const { data: saved, error: saveError } = await supabase
            .from('user_devotionals')
            .upsert({
                user_id: userId,
                title: devotionalContent.title,
                content: devotionalContent.content,
                topics: devotionalTopics,
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
 */
const generateDevotionalWithAI = async (topics) => {
    try {
        // Import the AI module dynamically to avoid circular dependencies
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

        const topicList = topics.join(', ');

        const prompt = `You are a warm, encouraging Bible teacher. Write a short daily devotional (250-350 words) focused on: ${topicList}.

Structure:
1. Opening thought (1-2 sentences connecting to daily life)
2. Scripture verse (choose ONE relevant verse, quote it fully)
3. Reflection (explain the verse and how it applies to the topics)
4. Practical application (one specific thing the reader can do today)
5. Closing prayer (2-3 sentences)

Format the scripture reference as **Book Chapter:Verse** in bold.
Keep the tone warm, personal, and encouraging - like a friend sharing wisdom.
Do not use overly formal or preachy language.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        // Generate a title based on topics
        const titlePrompt = `Create a short, engaging title (5-8 words max) for a devotional about: ${topicList}. Return ONLY the title, no quotes or formatting.`;
        const titleResult = await model.generateContent(titlePrompt);
        const title = titleResult.response.text().trim().replace(/['"]/g, '');

        return {
            success: true,
            title: title,
            content: content
        };
    } catch (err) {
        console.error('Error generating devotional with AI:', err);
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

        // Count topic occurrences
        const topicKeywords = ['love', 'faith', 'prayer', 'forgiveness', 'peace', 'hope', 'grace', 'healing', 'wisdom', 'strength'];
        const counts = {};

        (data || []).forEach(item => {
            const query = item.query.toLowerCase();
            topicKeywords.forEach(topic => {
                if (query.includes(topic)) {
                    counts[topic] = (counts[topic] || 0) + 1;
                }
            });
        });

        const trending = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, count]) => ({ topic, count }));

        return { success: true, topics: trending };
    } catch (err) {
        console.error('Error getting trending topics:', err);
        return { success: false, topics: [] };
    }
};
