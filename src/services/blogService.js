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

/**
 * Get recommended posts - generates fresh AI articles on each load
 */
export const getRecommendedPosts = async (userId) => {
    try {
        // First, analyze user's interests from their history
        const { topics } = await analyzeUserInterests(userId);
        const userTopics = topics.map(t => t.topic);

        // Use user topics or defaults
        const articleTopics = userTopics.length > 0
            ? userTopics.slice(0, 3)
            : ['faith', 'love', 'hope'];

        // Generate 2-3 fresh AI articles based on topics
        const articles = await Promise.all(
            articleTopics.slice(0, 2).map(async (topic, index) => {
                const article = await generateFreshArticle(topic, index);
                return article;
            })
        );

        // Filter out any failed generations
        const successfulArticles = articles.filter(a => a !== null);

        return {
            success: true,
            posts: successfulArticles,
            personalized: userTopics.length > 0,
            generated: true
        };
    } catch (err) {
        console.error('Error getting recommended posts:', err);
        // Fallback to static posts from database
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
 */
export const getDailyDevotional = async (userId, forceGenerate = false) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if rate limiting is enabled
        const rateLimited = await isRateLimitEnabled();

        if (rateLimited && !forceGenerate) {
            // Check if user already has today's devotional
            const { data: existing, error: existingError } = await supabase
                .from('user_devotionals')
                .select('*')
                .eq('user_id', userId)
                .eq('generated_date', today)
                .single();

            if (!existingError && existing) {
                return {
                    success: true,
                    devotional: existing,
                    cached: true,
                    message: 'Showing your daily devotional (limit: 1/day)'
                };
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

        // Save to database
        const { data: saved, error: saveError } = await supabase
            .from('user_devotionals')
            .upsert({
                user_id: userId,
                title: devotionalContent.title,
                content: devotionalContent.content,
                topics: devotionalTopics,
                generated_date: today
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
