import { supabase } from '../config/supabaseClient';
import { AFRIKAANS_BOOK_NAMES } from '../constants/bookNames';

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
                red_letters,
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
        const terms = searchQuery.split(',').map(t => t.trim()).filter(t => t.length > 0);

        let query = supabase
            .from('verses')
            .select(`
                id,
                book_id,
                chapter,
                verse,
                text,
                version,
                red_letters,
                ${bookJoin} (
                    id,
                    name_full,
                    testament
                )
            `);

        if (terms.length > 1) {
            // Support multiple words via OR clause: text.ilike.%term1%,text.ilike.%term2%
            const orFilter = terms.map(t => `text.ilike.%${t}%`).join(',');
            query = query.or(orFilter);
        } else {
            query = query.ilike('text', `%${searchQuery}%`);
        }

        query = query.order('book_id')
            .order('chapter')
            .order('verse')
            .limit(1000);

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
 * Get current User ID (Auth user if logged in, otherwise anonymous local ID)
 */
export const getUserId = async () => {
    try {
        // First check: get session
        let { data: { session } } = await supabase.auth.getSession();

        // If no session, wait just a tiny bit and try one more time 
        // (helps with fast page loads where session isn't quite ready)
        if (!session) {
            await new Promise(r => setTimeout(r, 150));
            const retry = await supabase.auth.getSession();
            session = retry.data.session;
        }

        if (session?.user) {
            const uid = session.user.id;
            const email = session.user.email;

            // Sync email to user_profiles for stats grouping
            if (email) {
                // Background update, don't await/block
                supabase.from('user_profiles').upsert({
                    user_id: uid,
                    email: email,
                    last_seen: new Date().toISOString()
                }).then(({ error }) => {
                    if (error) console.warn('[ProfileSync] Error syncing profile:', error.message);
                });
            }

            // If logged in, we definitely don't want a guest ID sticking around
            if (localStorage.getItem('bible_user_id')) {
                localStorage.removeItem('bible_user_id');
            }
            return uid;
        }
    } catch (e) {
        console.warn('Error checking auth session', e);
    }

    let userId = localStorage.getItem('bible_user_id');
    if (!userId) {
        // Generate random ID
        userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('bible_user_id', userId);

        // Initialize new user (check for auto-super-user)
        initializeNewUser(userId).catch(err => console.error('User initialization failed:', err));
    }
    return userId;
};

/**
 * Initialize a new user (Internal Logic)
 * Checks if 'super_users_auto' is enabled and adds user if true.
 * Implemented directly here to avoid circular dependency with blogService.
 */
const initializeNewUser = async (userId) => {
    try {
        console.log('[InitUser] 🆕 Initializing new user:', userId);

        // 1. Check if Auto-SuperUser is enabled
        const { data: setting, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'super_users_auto')
            .single();

        if (error) console.error('[InitUser] ⚠️ Error fetching setting:', error);

        console.log('[InitUser] ⚙️ Auto-SuperUser Setting Value:', setting?.value);

        if (setting?.value !== 'true') {
            console.log('[InitUser] ⏭️ Skipping promotion (Feature is OFF)');
            return;
        }

        console.log('✨ Auto-SuperUser enabled: Promoting new user', userId);

        // 2. Fetch current super users directly
        const { data: currentListData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'super_users')
            .single();

        let currentUsers = [];
        if (currentListData?.value) {
            try {
                currentUsers = JSON.parse(currentListData.value);
            } catch (e) {
                console.warn('Failed to parse super_users JSON', e);
            }
        }

        if (currentUsers.includes(userId)) return;

        // 3. Add user and save
        const newList = [...currentUsers, userId];
        await supabase
            .from('app_settings')
            .upsert({
                key: 'super_users',
                value: JSON.stringify(newList),
                updated_at: new Date().toISOString()
            });

        console.log('✅ New user successfully auto-promoted to Super User');
    } catch (err) {
        console.error('Error in initializeNewUser:', err);
    }
};

/**
 * Log search query for analytics
 */
export const logSearch = async (query, version, testament) => {
    try {
        const userId = await getUserId();
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
        // 1. Fetch search and AI logs
        const searchReq = supabase.from('search_logs').select('user_id, device_info').limit(5000);
        const aiReq = supabase.from('ai_questions').select('user_id, device_info').limit(5000);
        const profileReq = supabase.from('user_profiles').select('user_id, email');

        const [searchRes, aiRes, profileRes] = await Promise.all([searchReq, aiReq, profileReq]);

        if (searchRes.error) throw searchRes.error;
        if (aiRes.error) throw aiRes.error;

        // Map userId to email for quick lookup
        const profileMap = {};
        if (profileRes.data) {
            profileRes.data.forEach(p => {
                profileMap[p.user_id] = p.email;
            });
        }

        // Combined list of all actions
        const allActions = [
            ...searchRes.data.map(d => ({ user: d.user_id, type: 'search', device: d.device_info })),
            ...aiRes.data.map(d => ({ user: d.user_id, type: 'ai', device: d.device_info }))
        ];

        // 2. User Activity Count & Device Parsing
        const userStats = {};

        allActions.forEach(action => {
            const uid = action.user || 'Anonymous';
            // Determine the "identity" of this user - if they have an email, use it to group
            const identity = profileMap[uid] || uid;

            if (!userStats[identity]) {
                userStats[identity] = {
                    count: 0,
                    devices: [],
                    email: profileMap[uid] || null,
                    originalIds: new Set()
                };
            }
            userStats[identity].count++;
            userStats[identity].originalIds.add(uid);
            if (action.device) {
                userStats[identity].devices.push(action.device);
            }
        });

        // Unique users count based on identity (email if available)
        const totalUniqueUsers = Object.keys(userStats).length;

        // Helper to get formatted device name
        const getDeviceName = (userAgents) => {
            if (!userAgents || userAgents.length === 0) return 'Unknown';
            // Use the most common device type
            const counts = userAgents.reduce((acc, ua) => {
                let type = '❓ Unknown';
                if (/iPhone|iPad|iPod/.test(ua)) type = '📱 iOS';
                else if (/Android/.test(ua)) type = '📱 Android';
                else if (/Windows/.test(ua)) type = '💻 Windows';
                else if (/Macintosh|Mac OS X/.test(ua)) type = '💻 Mac';
                else if (/Linux/.test(ua)) type = '🐧 Linux';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

            return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        };

        // 3. Sort by activity
        const topUsers = Object.entries(userStats)
            .map(([identity, stats]) => ({
                userId: identity, // This will be the email if available, otherwise userId
                displayId: stats.email || identity,
                email: stats.email,
                count: stats.count,
                device: getDeviceName(stats.devices),
                fullUserAgents: [...new Set(stats.devices)].slice(0, 5),
                isGroupedByEmail: !!stats.email
            }))
            .sort((a, b) => b.count - a.count);

        return {
            success: true,
            data: {
                totalUsers: totalUniqueUsers,
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

        let userIdsToFetch = [cleanUserId];

        // If this ID looks like an email, find all linked IDs
        if (cleanUserId.includes('@')) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('user_id')
                .eq('email', cleanUserId);

            if (profiles && profiles.length > 0) {
                userIdsToFetch = profiles.map(p => p.user_id);
            }
        }

        // 1. Query by all associated IDs
        const searchReq = supabase
            .from('search_logs')
            .select('*')
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(50);

        const aiReq = supabase
            .from('ai_questions')
            .select('*')
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(50);

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
/**
 * Get the original language (Greek or Hebrew) text for a specific verse
 */
export const getOriginalVerse = async (bookId, chapter, verse) => {
    try {
        // 1. Get book testament
        const { data: book } = await supabase
            .from('books')
            .select('testament')
            .eq('id', bookId)
            .single();

        if (!book) throw new Error('Book not found');

        const versionId = book.testament === 'NT' ? 'SBLGNT' : 'WLC';

        const { data, error } = await supabase
            .from('verses')
            .select('text')
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse)
            .eq('version', versionId)
            .single();

        if (error) throw error;
        return { success: true, text: data?.text, version: versionId };
    } catch (error) {
        console.error('Error fetching original verse:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get a specific verse by ID components
 */
export const getVerse = async (bookId, chapter, verse, versionId = 'KJV') => {
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
                red_letters,
                books (
                    id,
                    name_full,
                    testament
                )
            `)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse)
            .eq('version', versionId)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching verse:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Find a verse by a reference string like "John 3:16" or "1 John 1:1"
 */
export const getVerseByReference = async (refString, versionId = 'KJV') => {
    try {
        // Simple parser for "Book Chapter:Verse"
        const match = refString.match(/(.+?)\s+(\d+)[:\s]+(\d+)/);
        if (!match) throw new Error('Invalid reference format');

        const [_, bookName, chapter, verse] = match;
        let bookId;

        // 1. If bookName is a number, it's likely a direct ID
        if (/^\d+$/.test(bookName.trim())) {
            bookId = parseInt(bookName.trim());
        } else {
            // Find book ID by name
            let targetBookName = bookName.trim();

            // Check if name is Afrikaans and map to English for DB lookup
            const englishName = Object.keys(AFRIKAANS_BOOK_NAMES).find(key =>
                AFRIKAANS_BOOK_NAMES[key].toLowerCase() === targetBookName.toLowerCase()
            );
            if (englishName) {
                targetBookName = englishName;
            }

            const { data: books, error: bookError } = await supabase
                .from('books')
                .select('id')
                .ilike('name_full', `%${targetBookName}%`)
                .limit(1);

            if (bookError || !books || books.length === 0) throw new Error('Book not found');
            bookId = books[0].id;
        }

        // 2. Get the verse
        return await getVerse(bookId, parseInt(chapter), parseInt(verse), versionId);
    } catch (error) {
        console.error('Error fetching verse by reference:', error);
        return { success: false, error: error.message };
    }
};
