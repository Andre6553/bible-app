import { supabase } from '../config/supabaseClient';

/**
 * Bible Service - Handles all Bible data operations with Supabase
 */

export const SUPPORTED_VERSIONS = [
    { id: 'AFR53', name: 'Afrikaans 1953', abbreviation: 'AFR53' },
    { id: 'KJV', name: 'King James Version', abbreviation: 'KJV' },
    { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV' },
    { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT' },
    { id: 'AMP', name: 'Amplified Bible', abbreviation: 'AMP' },
    { id: 'AFR83', name: 'Afrikaans 1983', abbreviation: 'AFR83' },
    { id: 'AFRNLV', name: 'Afrikaanse Nuwe Lewe', abbreviation: 'AFR NLV' },
    { id: 'XHO22', name: 'Xhosa 2022', abbreviation: 'XHO22' },
];

/**
 * Get all available Bible versions
 */
export const getVersions = async () => {
    // Return hardcoded list as per requirements/schema limitations
    return { success: true, data: SUPPORTED_VERSIONS };
};

/**
 * Get all books grouped by testament
 */
export const getBooks = async () => {
    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('order'); // specified as 'order' in prompt

        if (error) throw error;

        // Group by testament
        const oldTestament = data.filter(book => book.testament === 'OT');
        const newTestament = data.filter(book => book.testament === 'NT');

        return {
            success: true,
            data: {
                oldTestament,
                newTestament,
                all: data
            }
        };
    } catch (error) {
        console.error('Error fetching books:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get a specific chapter with all verses
 * Caches the last 10 opened chapters in localStorage
 * Also checks IndexedDB for offline downloaded versions
 */
export const getChapter = async (bookId, chapter, versionId = 'KJV') => {
    const cacheKey = `chapter_${bookId}_${chapter}_${versionId}`;

    // 1. Try to get from cache first
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            console.log('Serving chapter from cache');
            return { success: true, data: JSON.parse(cached) };
        }
    } catch (e) {
        console.warn('Error reading from localStorage', e);
    }

    // 2. Check IndexedDB for offline version
    try {
        const { getOfflineChapter } = await import('./offlineService');
        const offlineData = await getOfflineChapter(bookId, chapter, versionId);
        if (offlineData && offlineData.length > 0) {
            console.log('📴 Serving chapter from offline storage');
            return { success: true, data: offlineData };
        }
    } catch (e) {
        console.warn('Error checking offline storage', e);
    }

    // 3. Fetch from network
    try {
        const { data, error } = await supabase
            .from('verses')
            .select(`
                id,
                book_id,
                chapter,
                verse,
                text,
                version,
                books (
                    id,
                    name_full,
                    testament
                )
            `)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('version', versionId) // Using string column
            .order('verse');

        if (error) throw error;

        // 3. Save to cache if successful
        if (data && data.length > 0) {
            try {
                // Save content
                localStorage.setItem(cacheKey, JSON.stringify(data));

                // Update recent chapters list to maintain limit of 10
                const recentKeysStr = localStorage.getItem('recentChapters');
                let recentKeys = recentKeysStr ? JSON.parse(recentKeysStr) : [];

                // Remove this key if it already exists (to move it to top)
                recentKeys = recentKeys.filter(k => k !== cacheKey);

                // Add to beginning
                recentKeys.unshift(cacheKey);

                // Trim to 10
                if (recentKeys.length > 10) {
                    const removedKeys = recentKeys.splice(10);
                    // Remove old data from localStorage
                    removedKeys.forEach(k => localStorage.removeItem(k));
                }

                localStorage.setItem('recentChapters', JSON.stringify(recentKeys));
            } catch (e) {
                console.warn('Error saving to localStorage', e);
            }
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error fetching chapter:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get chapter count for a specific book
 */
export const getChapterCount = async (bookId) => {
    try {
        // We can find the max chapter number for a book
        // Since we don't have a chapters table, we query verses
        // This is a bit heavy but works for this schema
        const { data, error } = await supabase
            .from('verses')
            .select('chapter')
            .eq('book_id', bookId)
            .order('chapter', { ascending: false })
            .limit(1);

        if (error) throw error;
        return {
            success: true,
            data: data.length > 0 ? data[0].chapter : 0
        };
    } catch (error) {
        console.error('Error fetching chapter count:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get verse count for a specific chapter
 */
export const getVerseCount = async (bookId, chapter) => {
    try {
        const { data, error } = await supabase
            .from('verses')
            .select('verse')
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .order('verse', { ascending: false })
            .limit(1);

        if (error) throw error;
        return {
            success: true,
            data: data.length > 0 ? data[0].verse : 0
        };
    } catch (error) {
        console.error('Error fetching verse count:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Search verses by keyword or phrase
 */
export const searchVerses = async (searchQuery, versionId = null, testament = 'all') => {
    try {
        // Use !inner join if we need to filter by testament, otherwise standard join
        const bookJoin = testament !== 'all' ? 'books!inner' : 'books';

        let query = supabase
            .from('verses')
            .select(`
                id,
                book_id,
                chapter,
                verse,
                text,
                version,
                ${bookJoin} (
                    id,
                    name_full,
                    testament
                )
            `)
            .ilike('text', `%${searchQuery}%`)
            .order('book_id')
            .order('chapter')
            .order('verse')
            .limit(1000); // Increased limit to find more results

        // Filter by version if specified, otherwise search all
        if (versionId && versionId !== 'all') {
            query = query.eq('version', versionId);
        }

        // Filter by testament
        if (testament && testament !== 'all') {
            query = query.eq('books.testament', testament);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Log search asynchronously
        logSearch(searchQuery, versionId, testament);

        return { success: true, data };
    } catch (error) {
        console.error('Error searching verses:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get verse reference text (book name, chapter:verse)
 */
export const getVerseReference = (verse) => {
    if (!verse || !verse.books) return '';
    return `${verse.books.name_full} ${verse.chapter}:${verse.verse}`;
};

/**
 * Get or create User ID for analytics
 */
export const getUserId = () => {
    let userId = localStorage.getItem('bible_user_id'); // Use same key as AI search
    if (!userId) {
        // Generate random ID (simple implementation)
        userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('bible_user_id', userId);
    }
    return userId;
};

/**
 * Log search query for analytics
 */
export const logSearch = async (query, version, testament) => {
    try {
        const userId = getUserId();
        await supabase.from('search_logs').insert([
            {
                query,
                version: version || 'all',
                testament: testament || 'all',
                user_id: userId,
                device_info: navigator.userAgent
            }
        ]);
    } catch (err) {
        // Silently fail
        console.error('Analytics log error', err);
    }
};

/**
 * Get User Statistics (Total Users, Most Active)
 */
export const getUserStatistics = async () => {
    try {
        // Fetch raw user_ids and device_info from both tables
        const searchReq = supabase.from('search_logs').select('user_id, device_info').limit(5000);
        const aiReq = supabase.from('ai_questions').select('user_id, device_info').limit(5000);

        const [searchRes, aiRes] = await Promise.all([searchReq, aiReq]);

        if (searchRes.error) throw searchRes.error;
        if (aiRes.error) throw aiRes.error;

        // Combined list of all actions
        const allActions = [
            ...searchRes.data.map(d => ({ user: d.user_id, type: 'search', device: d.device_info })),
            ...aiRes.data.map(d => ({ user: d.user_id, type: 'ai', device: d.device_info }))
        ];

        // 1. Unique Users Count
        const uniqueUsers = new Set(allActions.map(a => a.user)).size;

        // 2. User Activity Count & Device Parsing
        const userStats = {};

        allActions.forEach(action => {
            const uid = action.user || 'Anonymous';
            if (!userStats[uid]) {
                userStats[uid] = { count: 0, devices: [] };
            }
            userStats[uid].count++;
            if (action.device) {
                userStats[uid].devices.push(action.device);
            }
        });

        // Helper to get formatted device name
        const getDeviceName = (userAgents) => {
            if (!userAgents || userAgents.length === 0) return 'Unknown';
            // Simple frequency count of user agents
            const ua = userAgents[userAgents.length - 1]; // Use most recent for now

            if (/iPhone|iPad|iPod/.test(ua)) return '📱 iOS';
            if (/Android/.test(ua)) return '📱 Android';
            if (/Windows/.test(ua)) return '💻 Windows';
            if (/Macintosh|Mac OS X/.test(ua)) return '💻 Mac';
            if (/Linux/.test(ua)) return '🐧 Linux';
            return '❓ Unknown';
        };

        // 3. Sort by activity
        const topUsers = Object.entries(userStats)
            .map(([userId, stats]) => ({
                userId,
                count: stats.count,
                device: getDeviceName(stats.devices),
                fullUserAgents: [...new Set(stats.devices)].slice(0, 5) // Store unique UAs
            }))
            .sort((a, b) => b.count - a.count); // Return all users, sorted by activity

        return {
            success: true,
            data: {
                totalUsers: uniqueUsers,
                topUsers: topUsers
            }
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get specific history for a user
 */
export const getUserHistory = async (userId) => {
    try {
        const cleanUserId = userId?.trim();
        if (!cleanUserId) return { success: false, searches: [], aiQuestions: [] };

        // 1. Try Direct Query
        const searchReq = supabase
            .from('search_logs')
            .select('*')
            .eq('user_id', cleanUserId)
            .order('created_at', { ascending: false })
            .limit(20);

        const aiReq = supabase
            .from('ai_questions')
            .select('*')
            .eq('user_id', cleanUserId)
            .order('created_at', { ascending: false })
            .limit(20);

        const [searchRes, aiRes] = await Promise.all([searchReq, aiReq]);

        let searches = searchRes.data || [];
        let aiQuestions = aiRes.data || [];

        // 2. Fallback: If no results, try client-side filtering (handles potential column type casting issues)
        if (searches.length === 0) {
            console.log(`Direct search_logs query returned 0 for ${cleanUserId}, trying fallback (limit 5000)...`);
            const { data: allSearches } = await supabase
                .from('search_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000); // Increased to match stats limit

            if (allSearches) {
                // Manual loose comparison
                searches = allSearches.filter(s => s.user_id && s.user_id.trim() === cleanUserId).slice(0, 20);
                console.log(`Fallback found ${searches.length} searches`);
            }
        }

        if (aiQuestions.length === 0) {
            console.log(`Direct ai_questions query returned 0 for ${cleanUserId}, trying fallback (limit 5000)...`);
            const { data: allAi } = await supabase
                .from('ai_questions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (allAi) {
                aiQuestions = allAi.filter(q => q.user_id && q.user_id.trim() === cleanUserId).slice(0, 20);
                console.log(`Fallback found ${aiQuestions.length} ai questions`);
            }
        }

        return {
            success: true,
            searches,
            aiQuestions
        };
    } catch (error) {
        console.error('Error getting user history:', error);
        return { success: false, searches: [], aiQuestions: [] };
    }
};
